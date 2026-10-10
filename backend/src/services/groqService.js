const axios = require('axios');
const { createWorker } = require('tesseract.js');

/**
 * ─── DYNAMIC KEY ROTATION SYSTEM ────────────────────────────────────────────
 *
 * Automatically reads ALL env variables matching GROQ_API_KEY or GROQ_API_KEY_N
 * (N can be any number or suffix). To add a new key, simply add to .env:
 *   GROQ_API_KEY_11="gsk_..."
 *   GROQ_API_KEY_12="gsk_..."
 * No code changes needed.
 *
 * Rotation strategy: Round-robin across all available keys.
 * On 429 (rate limit) or 401 (key invalid) → automatically switches to next key.
 */

/**
 * Dynamically discover all GROQ_API_KEY* variables from process.env
 * Supports: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ..., GROQ_API_KEY_N
 */
const getGroqKeys = () => {
  const keys = Object.entries(process.env)
    .filter(([varName]) => /^GROQ_API_KEY(_\d+)?$/.test(varName))
    .sort(([a], [b]) => {
      // Sort: GROQ_API_KEY first, then GROQ_API_KEY_2, _3, ... in numeric order
      const numA = a === 'GROQ_API_KEY' ? 0 : parseInt(a.replace('GROQ_API_KEY_', ''), 10) || 999;
      const numB = b === 'GROQ_API_KEY' ? 0 : parseInt(b.replace('GROQ_API_KEY_', ''), 10) || 999;
      return numA - numB;
    })
    .map(([, value]) => value)
    .filter(Boolean);

  if (keys.length === 0) {
    console.warn('[GroqService] ⚠ No GROQ_API_KEY* variables found in .env!');
  }

  return keys;
};

/**
 * Get the default Groq model from env, fallback to a reliable default
 */
const getGroqModel = () => {
  return process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
};

// Module-level round-robin index (persists across calls within same server session)
let currentKeyIndex = 0;

/**
 * Get the next API key in round-robin rotation
 */
const getNextGroqKey = () => {
  const keys = getGroqKeys();
  if (keys.length === 0) return null;
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
};

/**
 * ─── CORE GROQ API CALLER ────────────────────────────────────────────────────
 * Calls Groq Chat Completions API.
 * Automatically rotates keys and models on 429 (rate limit), 401, or 503 errors.
 */
const callGroqAPI = async (payload, retries = null) => {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    throw new Error('[GroqService] No Groq API keys available.');
  }

  // Use models that are confirmed available on this Groq account
  const primaryModel = payload.model || getGroqModel();
  const fallbackModels = [
    primaryModel,
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'allam-2-7b'
  ].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

  let lastError = null;

  for (const modelCandidate of fallbackModels) {
    const currentPayload = { ...payload, model: modelCandidate };
    const maxAttempts = retries !== null ? Math.min(retries, keys.length) : keys.length;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = getNextGroqKey();

      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          currentPayload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        return response.data;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        console.warn(`[GroqService] Attempt ${attempt+1} failed (HTTP ${status}) for model ${modelCandidate}.`);
        if (status === 429 || status === 401 || status === 503 || status === 404) {
          continue; // Try next key / model
        }
        break; // For other errors, stop retrying this model
      }
    }
  }

  console.error('[GroqService] All Groq API key and model candidates exhausted.');
  throw lastError;
};


/**
 * ─── TESSERACT OCR ───────────────────────────────────────────────────────────
 * Extract raw text from image buffer using Tesseract.js (fallback for non-vision models)
 */
const extractTextFromImageOCR = async (imageBase64Data) => {
  let worker = null;
  try {
    const cleanBase64 = imageBase64Data.includes(',')
      ? imageBase64Data.split(',')[1]
      : imageBase64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');

    worker = await createWorker('eng');
    const ret = await worker.recognize(buffer).catch(() => ({ data: { text: '' } }));
    await worker.terminate().catch(() => {});
    const rawText = ret.data?.text || '';
    return rawText.replace(/[^\x20-\x7E\r\n\t]/g, '');
  } catch (err) {
    if (worker) await worker.terminate().catch(() => {});
    console.error('[GroqService] Tesseract OCR error:', err.message);
    return '';
  }
};


/**
 * ─── INVOICE OCR + AI PARSER ─────────────────────────────────────────────────
 * Parse a purchase receipt/invoice image via:
 *   1. Groq Vision API (qwen/qwen3.8-27b - direct image analysis, best quality)
 *   2. Tesseract OCR → Groq text LLM (fallback if vision fails)
 */
const analyzeInvoiceImageWithGroq = async (imageBase64Data) => {
  const invoicePrompt = `You are an expert Invoice Parser AI for a Restaurant POS system.
Analyze this purchase receipt or invoice image and extract all item details.
Output ONLY valid JSON in exactly this format:
{
  "supplierName": "Supplier or store name if visible, else null",
  "invoiceNumber": "Invoice/Bill Number if visible, else null",
  "date": "YYYY-MM-DD format if visible, else null",
  "items": [
    {
      "rawName": "Full item name (e.g. Chicken Breast, Cooking Oil, Basmati Rice)",
      "quantity": 10,
      "unit": "KG, G, L, ML, PCS, BOX, DOZEN, or BAG",
      "unitCost": 450,
      "totalCost": 4500,
      "batchNumber": "Batch or Lot number if visible, else null",
      "expiryDate": "YYYY-MM-DD if visible, else null"
    }
  ]
}

Rules:
- Extract EVERY item listed on the receipt/invoice
- If unit cost not shown but total and quantity are, calculate unit cost = total / quantity
- Use null for any field not visible
- Respond ONLY with valid JSON, no explanation`;

  // ── Strategy 1: Groq Vision API (direct image understanding) ────────────────
  try {
    console.log('[GroqService] Attempting Groq Vision API for invoice image...');

    // Ensure the image has a proper data URL prefix for vision API
    const imageUrl = imageBase64Data.startsWith('data:')
      ? imageBase64Data
      : `data:image/jpeg;base64,${imageBase64Data}`;

    const resData = await callGroqAPI({
      model: 'qwen/qwen3.8-27b',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: invoicePrompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 2000
    });

    if (resData) {
      const content = resData.choices?.[0]?.message?.content || '';
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          console.log(`[GroqService] ✓ Vision API extracted ${parsed.items.length} items from invoice.`);
          return parsed;
        }
      }
    }
  } catch (visionErr) {
    console.warn('[GroqService] Vision API failed, falling back to Tesseract OCR:', visionErr.message);
  }

  // ── Strategy 2: Tesseract OCR → Groq text LLM (fallback) ───────────────────
  try {
    console.log('[GroqService] Fallback: Running Tesseract OCR on invoice image...');
    const extractedText = await extractTextFromImageOCR(imageBase64Data);

    if (!extractedText || extractedText.trim().length < 10) {
      console.warn('[GroqService] Tesseract OCR yielded empty or too-short text.');
      return null;
    }

    console.log(`[GroqService] OCR text (${extractedText.length} chars), sending to Groq LLM...`);

    const textPrompt = `You are an expert Invoice Parser AI for a Restaurant POS system.
Analyze the following OCR text extracted from a purchase receipt or invoice and output strict JSON:
{
  "supplierName": "Supplier or store name if found, else null",
  "invoiceNumber": "Invoice/Bill Number if found, else null",
  "date": "YYYY-MM-DD if found, else null",
  "items": [
    {
      "rawName": "Full item name",
      "quantity": 10,
      "unit": "KG, G, L, ML, PCS, BOX, DOZEN, or BAG",
      "unitCost": 450,
      "totalCost": 4500,
      "batchNumber": null,
      "expiryDate": null
    }
  ]
}

OCR Receipt Text:
"""
${extractedText.substring(0, 3000)}
"""

Respond ONLY with valid JSON.`;

    const resData = await callGroqAPI({
      model: getGroqModel(),
      messages: [{ role: 'user', content: textPrompt }],
      temperature: 0.1,
      max_tokens: 2000
    });

    if (!resData) return null;

    const content = resData.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[GroqService] ✓ OCR+LLM extracted ${parsed.items?.length || 0} items from invoice.`);
      return parsed;
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[GroqService] Invoice scan failed (both strategies):', err.message);
    return null;
  }
};


/**
 * ─── AI BUSINESS INSIGHTS GENERATOR ──────────────────────────────────────────
 * Generate real AI-powered executive summary & actionable insights for POS
 */
const generateRealAIInsightsWithGroq = async ({ inventoryStats, salesSummary, kitchenStats }) => {
  try {
    const promptText = `You are the AI Business Intelligence engine for a POS & Inventory System.
Analyze the following factual database metrics and generate natural language executive summary and actionable advice.

CRITICAL INSTRUCTIONS:
1. DO NOT invent sales, orders, revenue, inventory quantities, costs, demand numbers, prediction accuracy, or stock levels.
2. Summarize and explain ONLY the provided factual database metrics below.
3. If data is limited, state clearly that historical data is growing.

FACTUAL DATABASE METRICS:
- Total Inventory Items: ${inventoryStats.totalItems}
- Low Stock Count: ${inventoryStats.lowStockCount}
- Critical Stockout Risks: ${inventoryStats.criticalCount}
- Total Inventory Valuation: PKR ${inventoryStats.totalValuation}
- Expiring Items (7 Days): ${inventoryStats.expiringCount}
- Stock Risk Items: ${JSON.stringify(inventoryStats.stockRiskAlerts || [])}
- Completed Orders (30 Days): ${salesSummary.totalOrders30Days || 0}
- Data History Span: ${salesSummary.dateSpanDays || 1} day(s)
- Kitchen Prep Time: ${kitchenStats.avgPrepTime ? `${kitchenStats.avgPrepTime} mins (${kitchenStats.isActualPrepTime ? 'actual' : 'configured'})` : 'Not enough data'}

Generate a structured JSON response with ONLY these keys:
{
  "executiveSummary": "A 2-3 sentence executive summary explaining inventory status and reorder priorities strictly based on the real metrics above.",
  "foodCostOptimization": [
    {
      "title": "Actionable Strategy Title",
      "impact": "High or Medium",
      "description": "Specific advice based on ingredient costs, low stock, or supplier purchasing."
    }
  ]
}

Respond ONLY with valid JSON.`;

    const resData = await callGroqAPI({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: 'You are a precise AI POS & Inventory Analyst that outputs JSON.' },
        { role: 'user', content: promptText }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });

    if (!resData) return null;

    const content = resData.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[GroqService] AI Insights generation failed:', err.message);
    return null;
  }
};


module.exports = {
  analyzeInvoiceImageWithGroq,
  generateRealAIInsightsWithGroq,
  callGroqAPI,
  getGroqModel,
  getGroqKeys
};

const axios = require('axios');
const { createWorker } = require('tesseract.js');

// Key pool for rotation
const getGroqKeys = () => {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
  ].filter(Boolean);
};

let currentKeyIndex = 0;

const getNextGroqKey = () => {
  const keys = getGroqKeys();
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
};

/**
 * Execute a Groq Chat Completion with API key rotation on rate limits
 */
const callGroqAPI = async (payload, retries = 3) => {
  const keys = getGroqKeys();
  let lastError = null;

  for (let attempt = 0; attempt < Math.min(retries, keys.length); attempt++) {
    const apiKey = getNextGroqKey();
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );
      return response.data;
    } catch (err) {
      console.warn(`[GroqService] Key attempt ${attempt + 1} failed:`, err.response?.data?.error?.message || err.message);
      lastError = err;
      if (err.response?.status === 429 || err.response?.status === 401) {
        continue;
      }
      break;
    }
  }
  throw lastError;
};

/**
 * Perform Tesseract OCR text extraction on image buffer or base64 string
 */
const extractTextFromImageOCR = async (imageBase64Data) => {
  let worker = null;
  try {
    const cleanBase64 = imageBase64Data.includes(',')
      ? imageBase64Data.split(',')[1]
      : imageBase64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');

    worker = await createWorker('eng');
    const ret = await worker.recognize(buffer);
    await worker.terminate();
    const rawText = ret.data?.text || '';
    return rawText.replace(/[^\x20-\x7E\r\n\t]/g, '');
  } catch (err) {
    if (worker) await worker.terminate().catch(() => {});
    console.error('[GroqService] Tesseract OCR error:', err.message);
    return '';
  }
};

/**
 * Parse an invoice / purchase receipt image using Tesseract OCR + Groq AI LLM
 */
const analyzeInvoiceImageWithGroq = async (imageBase64Data) => {
  try {
    console.log('[GroqService] Running Tesseract OCR on receipt image...');
    const extractedText = await extractTextFromImageOCR(imageBase64Data);

    if (!extractedText || extractedText.trim().length < 5) {
      console.warn('[GroqService] Tesseract OCR yielded empty text.');
      return null;
    }

    console.log('[GroqService] Sending extracted OCR text to Groq AI LLM...');

    const promptText = `
You are an expert Invoice Parser AI for a Restaurant POS system.
Analyze the following OCR text extracted from a purchase receipt or invoice and output strict JSON:
{
  "supplierName": "Supplier or store name if found, else null",
  "invoiceNumber": "Invoice/Bill Number if found, else null",
  "date": "YYYY-MM-DD if found, else null",
  "items": [
    {
      "rawName": "Full item name (e.g. Chicken Breast, Cooking Oil, Basmati Rice)",
      "quantity": 10,
      "unit": "KG, G, L, ML, PCS, BOX, or BAG",
      "unitCost": 450,
      "totalCost": 4500,
      "batchNumber": "Batch or Lot number if present, else null",
      "expiryDate": "YYYY-MM-DD if present, else null"
    }
  ]
}

Extracted OCR Receipt Text:
"""
${extractedText}
"""

Respond ONLY with valid JSON.
`;

    const activeModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    let resData = null;

    for (const model of activeModels) {
      try {
        resData = await callGroqAPI({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.1,
          max_tokens: 1500
        });
        if (resData) break;
      } catch (mErr) {
        console.warn(`[GroqService] Model ${model} failed, trying fallback...`);
      }
    }

    if (!resData) return null;

    const content = resData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (err) {
    console.error('[GroqService] Invoice scan failed:', err.message);
    return null;
  }
};

/**
 * Generate Real AI Machine Learning Insights for POS & Inventory using Groq LLM
 */
const generateRealAIInsightsWithGroq = async ({ inventoryStats, salesSummary, kitchenStats }) => {
  try {
    const promptText = `
You are the AI Business Intelligence engine for a POS & Inventory System.
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

Respond ONLY with valid JSON.
`;

    const activeModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    let resData = null;

    for (const model of activeModels) {
      try {
        resData = await callGroqAPI({
          model,
          messages: [
            { role: 'system', content: 'You are a precise AI POS & Inventory Analyst that outputs JSON.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.2,
          max_tokens: 1500
        });
        if (resData) break;
      } catch (mErr) {
        console.warn(`[GroqService] Insights model ${model} failed, trying fallback...`);
      }
    }

    if (!resData) return null;

    const content = resData.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (err) {
    console.error('[GroqService] AI Insights generation failed:', err.message);
    return null;
  }
};

module.exports = {
  analyzeInvoiceImageWithGroq,
  generateRealAIInsightsWithGroq,
  callGroqAPI
};

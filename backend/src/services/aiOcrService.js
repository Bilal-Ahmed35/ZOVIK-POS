/**
 * AI / OCR Invoice & Excel/CSV Parsing and Catalog Matching Service for ZovikPOS
 * Supports .xlsx, .xls, .csv files, PDF/image OCR text, Groq AI Vision scan, and matches rows against InventoryItem catalog.
 */
const XLSX = require('xlsx');
const { prisma } = require('../config/db');
const { analyzeInvoiceImageWithGroq } = require('./groqService');

/**
 * Normalizes header string for fuzzy matching
 */
const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Urdu / English POS Alias Dictionary for Smart Match
const ITEM_ALIASES_MAP = {
  'aloo': ['potatoes', 'potato', 'fresh potatoes'],
  'potatoes': ['potatoes', 'potato', 'aloo', 'patato'],
  'potato': ['potatoes', 'potato', 'aloo'],
  'pyaz': ['onions', 'onion', 'pyaaz'],
  'onions': ['onions', 'onion', 'pyaz', 'pyaaz'],
  'onion': ['onions', 'onion', 'pyaz'],
  'tamatar': ['tomatoes', 'tomato'],
  'tomatoes': ['tomatoes', 'tomato', 'tamatar'],
  'tomato': ['tomatoes', 'tomato', 'tamatar'],
  'doodh': ['milk', 'fresh milk', 'tetrapak milk'],
  'milk': ['milk', 'fresh milk', 'doodh'],
  'anda': ['eggs', 'egg', 'anday', 'fresh eggs'],
  'eggs': ['eggs', 'egg', 'anda', 'anday'],
  'egg': ['eggs', 'egg', 'anda'],
  'adrak': ['ginger'],
  'ginger': ['ginger', 'adrak'],
  'lehsan': ['garlic', 'lahsan'],
  'garlic': ['garlic', 'lehsan', 'lahsan'],
  'hari mirch': ['green chillies', 'green chilli'],
  'dahi': ['yogurt', 'curd'],
  'yogurt': ['yogurt', 'dahi', 'curd'],
  'makhan': ['butter'],
  'butter': ['butter', 'makhan'],
  'aata': ['wheat flour', 'flour'],
  'flour': ['wheat flour', 'maida', 'aata', 'refined flour'],
  'maida': ['refined flour', 'all-purpose flour', 'maida'],
  'besan': ['gram flour', 'besan'],
  'chawal': ['basmati rice', 'rice', 'sella rice'],
  'rice': ['basmati rice', 'rice', 'sella rice', 'chawal'],
  'keema': ['mince', 'beef mince', 'chicken mince'],
  'qeema': ['mince', 'beef mince', 'chicken mince'],
  'qima': ['mince', 'beef mince'],
  'mince': ['mince', 'beef mince', 'chicken mince', 'keema', 'qeema'],
  'murghi': ['chicken', 'chicken breast', 'chicken boneless'],
  'chicken': ['chicken', 'chicken breast', 'chicken boneless', 'murghi'],
  'gosht': ['mutton', 'beef', 'meat'],
  'beef': ['beef', 'beef boneless', 'beef mince', 'gosht'],
  'mutton': ['mutton', 'mutton meat', 'gosht'],
  'tel': ['cooking oil', 'oil'],
  'oil': ['cooking oil', 'oil', 'tel', 'ghee'],
  'ghee': ['banaspati ghee', 'desi ghee', 'ghee', 'oil'],
  'namak': ['salt'],
  'salt': ['salt', 'namak'],
  'haldi': ['turmeric powder', 'turmeric'],
  'lal mirch': ['red chilli powder', 'red chilli'],
  'zeera': ['cumin seeds', 'cumin'],
  'chai': ['tea leaves', 'tea'],
  'tea': ['tea leaves', 'tea', 'chai patti', 'chai'],
  'cheeni': ['sugar'],
  'sugar': ['sugar', 'cheeni'],
  'bun': ['burger buns', 'sesame burger buns', 'buns'],
  'buns': ['burger buns', 'sesame burger buns', 'bun'],
  'ketchup': ['tomato ketchup'],
  'mayo': ['mayonnaise']
};

/**
 * Calculates Levenshtein Distance between two strings for typo tolerance
 */
const levenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Calculates string similarity ratio (0.0 to 1.0) using Levenshtein distance
 */
const calculateStringSimilarity = (str1, str2) => {
  const s1 = String(str1 || '').toLowerCase().trim();
  const s2 = String(str2 || '').toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(s1, s2);
  return (maxLen - dist) / maxLen;
};

/**
 * Smart Fuzzy Catalog Matcher
 * Analyzes raw item name from Excel / OCR invoice and matches against catalog items:
 * - SKU Match
 * - Exact Name Match
 * - Alias Dictionary Match (e.g. "Aloo" -> "Potatoes", "Chiken" -> "Chicken")
 * - Substring Match
 * - Levenshtein Distance Typo Match (e.g. "Chiken Boneles" -> "Chicken Boneless")
 * - Token Overlap Similarity Match
 */
const findBestFuzzyCatalogMatch = (rawName, sku, catalogItems) => {
  if (sku) {
    const skuMatch = catalogItems.find(c => c.sku && c.sku.toLowerCase().trim() === sku.toLowerCase().trim());
    if (skuMatch) return { item: skuMatch, confidence: 1.0 };
  }

  if (!rawName) return null;
  const cleanRaw = rawName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!cleanRaw) return null;

  // 1. Exact match (case insensitive)
  const exactMatch = catalogItems.find(c => c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() === cleanRaw);
  if (exactMatch) return { item: exactMatch, confidence: 1.0 };

  // 2. Alias dictionary lookup (Urdu / Roman Urdu / Synonyms)
  for (const [aliasKey, targetWords] of Object.entries(ITEM_ALIASES_MAP)) {
    if (cleanRaw.includes(aliasKey) || aliasKey.includes(cleanRaw)) {
      for (const targetWord of targetWords) {
        const aliasMatch = catalogItems.find(c => c.name.toLowerCase().includes(targetWord));
        if (aliasMatch) {
          return { item: aliasMatch, confidence: 0.95 };
        }
      }
    }
  }

  // 3. Substring match (e.g. "cooking oil" includes "oil", "chicken breast" includes "chicken")
  const subCandidates = catalogItems.filter(c => {
    const cleanCat = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return cleanCat.includes(cleanRaw) || cleanRaw.includes(cleanCat);
  });
  if (subCandidates.length === 1) {
    return { item: subCandidates[0], confidence: 0.90 };
  } else if (subCandidates.length > 1) {
    // Pick the substring candidate with closest string length / highest similarity
    let bestSub = subCandidates[0];
    let bestSim = 0;
    for (const cand of subCandidates) {
      const sim = calculateStringSimilarity(cleanRaw, cand.name);
      if (sim > bestSim) {
        bestSim = sim;
        bestSub = cand;
      }
    }
    return { item: bestSub, confidence: 0.88 };
  }

  // 4. Levenshtein Typo Tolerance + Token Similarity Match
  const rawTokens = cleanRaw.split(/\s+/).filter(w => w.length > 1);
  let bestItem = null;
  let bestScore = 0;

  for (const cat of catalogItems) {
    const cleanCat = cat.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const catTokens = cleanCat.split(/\s+/).filter(w => w.length > 1);

    // Direct string similarity ratio
    const directSim = calculateStringSimilarity(cleanRaw, cleanCat);

    // Token overlap score with Levenshtein tolerance
    let tokenMatches = 0;
    for (const rToken of rawTokens) {
      for (const cToken of catTokens) {
        if (cToken === rToken || cToken.includes(rToken) || rToken.includes(cToken)) {
          tokenMatches += 1.0;
          break;
        } else if (rToken.length > 3 && cToken.length > 3 && calculateStringSimilarity(rToken, cToken) >= 0.75) {
          tokenMatches += 0.8; // Typo match between tokens e.g. "chiken" ~ "chicken"
          break;
        }
      }
    }

    const tokenScore = rawTokens.length > 0 ? (tokenMatches / Math.max(rawTokens.length, catTokens.length)) : 0;
    const combinedScore = Math.max(directSim, tokenScore);

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestItem = cat;
    }
  }

  if (bestItem && bestScore >= 0.35) {
    return { item: bestItem, confidence: parseFloat(Math.min(0.92, bestScore + 0.1).toFixed(2)) };
  }

  return null;
};

/**
 * Parses buffer/base64/text from CSV, Excel, or Invoice payload and matches against catalog
 */
const parseAndMatchInvoice = async ({ rawText, fileBuffer, fileBase64, fileName, supplierNameHint }) => {
  let rawRows = [];
  let extractedInvoiceNumber = null;
  let extractedDate = null;
  let detectedSupplierName = supplierNameHint || null;

  // 1. Check if file is image / base64 image -> use Groq AI Vision
  const isImageBase64 = fileBase64 && (
    fileBase64.startsWith('data:image') ||
    (fileName && /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(fileName))
  );

  if (isImageBase64) {
    console.log('[AI OCR] Attempting Groq AI Vision scan for receipt image...');
    const groqResult = await analyzeInvoiceImageWithGroq(fileBase64);

    if (groqResult && Array.isArray(groqResult.items) && groqResult.items.length > 0) {
      if (groqResult.supplierName) detectedSupplierName = groqResult.supplierName;
      if (groqResult.invoiceNumber) extractedInvoiceNumber = groqResult.invoiceNumber;
      if (groqResult.date) extractedDate = groqResult.date;

      for (const item of groqResult.items) {
        if (item.rawName && item.quantity > 0) {
          rawRows.push({
            rawName: item.rawName,
            sku: null,
            quantity: parseFloat(item.quantity),
            unit: (item.unit || 'KG').toUpperCase(),
            unitCost: parseFloat(item.unitCost || 0),
            batchNumber: item.batchNumber || null,
            expiryDate: item.expiryDate || null,
          });
        }
      }
    }
  }

  // 2. Process Excel / CSV file buffer or base64 if provided and not image
  if (rawRows.length === 0 && (fileBuffer || fileBase64)) {
    try {
      const buffer = fileBuffer || Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const sheetJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (sheetJson && sheetJson.length > 0) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, sheetJson.length); i++) {
          const row = sheetJson[i].map(c => String(c).toLowerCase());
          if (row.some(c => c.includes('item') || c.includes('name') || c.includes('qty') || c.includes('quantity') || c.includes('product'))) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = sheetJson[headerRowIndex].map(h => normalizeHeader(h));
        
        const nameIdx = headers.findIndex(h => h.includes('item') || h.includes('name') || h.includes('product') || h.includes('ingredient'));
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code'));
        const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('amount') || h.includes('volume'));
        const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('uom') || h.includes('measure'));
        const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('price') || h.includes('rate'));
        const batchIdx = headers.findIndex(h => h.includes('batch') || h.includes('lot'));
        const expIdx = headers.findIndex(h => h.includes('exp') || h.includes('date'));

        for (let i = headerRowIndex + 1; i < sheetJson.length; i++) {
          const row = sheetJson[i];
          if (!row || row.length === 0) continue;

          const rawName = nameIdx !== -1 ? String(row[nameIdx]).trim() : String(row[0]).trim();
          const sku = skuIdx !== -1 ? String(row[skuIdx]).trim() : null;
          const qtyVal = qtyIdx !== -1 ? parseFloat(row[qtyIdx]) : parseFloat(row[1]);
          const unitVal = unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]).trim() : 'KG';
          const costVal = costIdx !== -1 && row[costIdx] ? parseFloat(row[costIdx]) : 0;
          const batchVal = batchIdx !== -1 && row[batchIdx] ? String(row[batchIdx]).trim() : null;
          const expVal = expIdx !== -1 && row[expIdx] ? String(row[expIdx]).trim() : null;

          if (rawName && !isNaN(qtyVal) && qtyVal > 0) {
            rawRows.push({
              rawName,
              sku: sku || null,
              quantity: qtyVal,
              unit: unitVal.toUpperCase(),
              unitCost: isNaN(costVal) ? 0 : costVal,
              batchNumber: batchVal || null,
              expiryDate: expVal || null,
            });
          }
        }
      }
    } catch (excelErr) {
      console.warn('Excel parse error:', excelErr.message);
    }
  }

  // 3. Fallback to rawText / CSV string parser if file buffer didn't yield rows
  if (rawRows.length === 0 && rawText && typeof rawText === 'string') {
    // Try XLSX to parse CSV text with header detection first (for structured CSV with column names)
    try {
      const csvBuffer = Buffer.from(rawText, 'utf-8');
      const workbook = XLSX.read(csvBuffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const sheetJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (sheetJson && sheetJson.length > 1) {
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, sheetJson.length); i++) {
          const row = sheetJson[i].map(c => String(c).toLowerCase());
          if (row.some(c => c.includes('item') || c.includes('name') || c.includes('qty') || c.includes('quantity') || c.includes('product'))) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = sheetJson[headerRowIndex].map(h => normalizeHeader(h));
        const nameIdx = headers.findIndex(h => h.includes('item') || h.includes('name') || h.includes('product') || h.includes('ingredient'));
        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code'));
        const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('received') || h.includes('amount'));
        const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('uom') || h.includes('measure'));
        const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('price') || h.includes('rate'));
        const batchIdx = headers.findIndex(h => h.includes('batch') || h.includes('lot'));
        const expIdx = headers.findIndex(h => h.includes('exp') || h.includes('expiry'));

        if (nameIdx !== -1) {
          for (let i = headerRowIndex + 1; i < sheetJson.length; i++) {
            const row = sheetJson[i];
            if (!row || row.every(c => !c)) continue;

            const rawName = String(row[nameIdx] || '').trim();
            const sku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : null;
            const qtyVal = qtyIdx !== -1 ? parseFloat(row[qtyIdx]) : parseFloat(row[1]);
            const unitVal = unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]).trim() : 'KG';
            const costVal = costIdx !== -1 && row[costIdx] ? parseFloat(row[costIdx]) : 0;
            const batchVal = batchIdx !== -1 && row[batchIdx] ? String(row[batchIdx]).trim() : null;
            const expVal = expIdx !== -1 && row[expIdx] ? String(row[expIdx]).trim() : null;

            if (rawName && !isNaN(qtyVal) && qtyVal > 0) {
              rawRows.push({
                rawName,
                sku: sku || null,
                quantity: qtyVal,
                unit: unitVal.toUpperCase(),
                unitCost: isNaN(costVal) ? 0 : costVal,
                batchNumber: batchVal || null,
                expiryDate: expVal || null,
              });
            }
          }
        }
      }
    } catch (csvXlsxErr) {
      console.warn('CSV XLSX parse failed, falling back to line parser:', csvXlsxErr.message);
    }

    // Simple line-by-line fallback for un-headered CSV/TSV plain text
    if (rawRows.length === 0) {
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        const invMatch = line.match(/(?:Invoice|INV|Ref)[#:\s]+([A-Za-z0-9-]+)/i);
        if (invMatch && !extractedInvoiceNumber) {
          extractedInvoiceNumber = invMatch[1];
          continue;
        }

        const dateMatch = line.match(/(?:Date|Dated)[#:\s]+(\d{2,4}[-/.]\d{1,2}[-/.]\d{1,4})/i);
        if (dateMatch && !extractedDate) {
          extractedDate = dateMatch[1];
          continue;
        }

        const parts = line.split(/,|\t|;|\|/).map(p => p.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const qtyStr = parts[1];
          const qty = parseFloat(qtyStr);

          if (name && !isNaN(qty) && qty > 0 && !name.toLowerCase().includes('item name') && !name.toLowerCase().includes('quantity')) {
            const unit = parts[2] || 'KG';
            const costStr = parts[3] ? parseFloat(parts[3]) : 0;
            const batch = parts[4] || null;
            const expiry = parts[5] || null;

            rawRows.push({
              rawName: name,
              sku: null,
              quantity: qty,
              unit: unit.toUpperCase(),
              unitCost: isNaN(costStr) ? 0 : costStr,
              batchNumber: batch,
              expiryDate: expiry,
            });
          }
        }
      }
    }
  }

  // Fetch full inventory catalog from DB for catalog matching
  const catalogItems = await prisma.inventoryItem.findMany({
    include: { supplier: true, branch: true },
  });

  const matched = [];
  const unmatched = [];
  const warnings = [];
  const seenIds = new Set();

  for (const item of rawRows) {
    const fuzzyResult = findBestFuzzyCatalogMatch(item.rawName, item.sku, catalogItems);

    if (fuzzyResult && fuzzyResult.item) {
      const match = fuzzyResult.item;

      if (seenIds.has(match.id)) {
        warnings.push(`Duplicate entry for "${match.name}" detected in receipt.`);
      }
      seenIds.add(match.id);

      matched.push({
        inventoryItemId: match.id,
        name: match.name,
        rawScannedName: item.rawName,
        category: match.category,
        sku: match.sku,
        currentStock: match.stockLevel,
        systemUnit: match.unit,
        quantity: item.quantity,
        unit: item.unit || match.unit,
        unitCost: item.unitCost || match.costPrice,
        totalCost: item.quantity * (item.unitCost || match.costPrice),
        batchNumber: item.batchNumber || null,
        expiryDate: item.expiryDate || null,
        confidence: fuzzyResult.confidence,
        status: 'MATCHED'
      });
    } else {
      unmatched.push({
        rawName: item.rawName,
        sku: item.sku || null,
        quantity: item.quantity,
        unit: item.unit || 'KG',
        unitCost: item.unitCost || 0,
        totalCost: item.quantity * (item.unitCost || 0),
        batchNumber: item.batchNumber || null,
        expiryDate: item.expiryDate || null,
        confidence: 0,
        status: 'NEEDS_MATCHING'
      });
    }
  }

  return {
    success: true,
    fileName: fileName || null,
    invoiceNumber: extractedInvoiceNumber || `INV-${Math.floor(10000 + Math.random() * 90000)}`,
    receivingDate: extractedDate || new Date().toISOString().split('T')[0],
    supplierName: detectedSupplierName || 'General Supplier / Market Purchase',
    matchedItems: matched,
    unmatchedItems: unmatched,
    warnings,
    summary: {
      totalRows: rawRows.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      estimatedTotalCost: matched.reduce((acc, i) => acc + i.totalCost, 0) + unmatched.reduce((acc, i) => acc + i.totalCost, 0),
    },
  };
};

module.exports = {
  parseAndMatchInvoice,
  findBestFuzzyCatalogMatch,
};

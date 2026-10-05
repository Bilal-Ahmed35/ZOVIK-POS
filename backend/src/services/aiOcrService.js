/**
 * AI / OCR Invoice & Excel/CSV Parsing and Catalog Matching Service for ZovikPOS
 * Supports .xlsx, .xls, .csv files, PDF/image OCR text, and matches rows against InventoryItem catalog.
 */
const XLSX = require('xlsx');
const { prisma } = require('../config/db');

/**
 * Normalizes header string for fuzzy matching
 */
const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Parses buffer/base64/text from CSV, Excel, or Invoice payload and matches against catalog
 */
const parseAndMatchInvoice = async ({ rawText, fileBuffer, fileBase64, fileName, supplierNameHint }) => {
  let rawRows = [];
  let extractedInvoiceNumber = null;
  let extractedDate = null;
  let detectedSupplierName = supplierNameHint || null;

  // 1. Process Excel / CSV file buffer or base64 if provided
  if (fileBuffer || fileBase64) {
    try {
      const buffer = fileBuffer || Buffer.from(fileBase64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const sheetJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (sheetJson && sheetJson.length > 0) {
        // Locate Header Row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, sheetJson.length); i++) {
          const row = sheetJson[i].map(c => String(c).toLowerCase());
          if (row.some(c => c.includes('item') || c.includes('name') || c.includes('qty') || c.includes('quantity') || c.includes('product'))) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = sheetJson[headerRowIndex].map(h => normalizeHeader(h));
        
        // Find Column Indices
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

  // 2. Fallback to rawText / CSV string parser if file buffer didn't yield rows
  if (rawRows.length === 0 && rawText && typeof rawText === 'string') {
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

  // Fetch full inventory catalog from DB for catalog matching
  const catalogItems = await prisma.inventoryItem.findMany({
    include: { supplier: true, branch: true },
  });

  const matched = [];
  const unmatched = [];
  const warnings = [];
  const seenIds = new Set();

  for (const item of rawRows) {
    const searchName = item.rawName.toLowerCase().trim();
    
    // Priority 1: Match by SKU
    let match = item.sku
      ? catalogItems.find(c => c.sku && c.sku.toLowerCase() === item.sku.toLowerCase())
      : null;

    // Priority 2: Match by exact Name (case insensitive)
    if (!match) {
      match = catalogItems.find(c => c.name.toLowerCase() === searchName);
    }

    // Priority 3: Unique candidate match if name is unique prefix/substring
    if (!match) {
      const candidates = catalogItems.filter(
        c => c.name.toLowerCase().includes(searchName) || searchName.includes(c.name.toLowerCase())
      );
      if (candidates.length === 1) {
        match = candidates[0];
      }
    }

    if (match) {
      if (seenIds.has(match.id)) {
        warnings.push(`Duplicate entry for "${match.name}" detected in shipment file.`);
      }
      seenIds.add(match.id);

      matched.push({
        inventoryItemId: match.id,
        name: match.name,
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
        confidence: match.name.toLowerCase() === searchName ? 1.0 : 0.85,
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
    invoiceNumber: extractedInvoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    receivingDate: extractedDate || new Date().toISOString().split('T')[0],
    supplierName: detectedSupplierName,
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
};

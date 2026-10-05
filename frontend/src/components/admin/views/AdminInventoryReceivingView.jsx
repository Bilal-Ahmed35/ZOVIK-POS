import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  FileText,
  Search,
  Upload,
  Sparkles,
  AlertTriangle,
  Calendar,
  Building2,
  DollarSign,
  Package,
  Layers,
  X,
  Eye,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  Download,
  FileUp,
  HelpCircle,
  Edit3
} from 'lucide-react';
import api from '../../../services/api';
import { exportToCSV } from '../../../utils/exportUtils';

const AdminInventoryReceivingView = ({ inventory = [], suppliers = [], onRefresh, showToast }) => {
  const [subTab, setSubTab] = useState('NEW_RECEIVING'); // NEW_RECEIVING | HISTORY
  const [loading, setLoading] = useState(false);
  const [receivingsList, setReceivingsList] = useState([]);
  
  // New Receiving Header Form State
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('1');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Multi-item rows array for receiving form
  const [receivingRows, setReceivingRows] = useState([
    {
      inventoryItemId: '',
      quantity: 1,
      unit: 'KG',
      unitCost: 0,
      batchNumber: '',
      expiryDate: '',
      notes: ''
    }
  ]);

  // Selected Receiving for Details Modal
  const [selectedReceiving, setSelectedReceiving] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // --- CSV / EXCEL FILE UPLOAD & PREVIEW MODAL STATE ---
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [rawCsvText, setRawCsvText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [parsingCsv, setParsingCsv] = useState(false);
  const [isDragOverCsv, setIsDragOverCsv] = useState(false);

  // --- AI / OCR INVOICE UPLOAD & PREVIEW MODAL STATE ---
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [ocrPreview, setOcrPreview] = useState(null);
  const [extractingOcr, setExtractingOcr] = useState(false);
  const [isDragOverOcr, setIsDragOverOcr] = useState(false);

  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  const fetchReceivings = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/receivings?status=${historyStatusFilter}&search=${historySearch}`);
      if (res.data?.receivings) {
        setReceivingsList(res.data.receivings);
      }
    } catch (err) {
      console.warn('Fetch receivings error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'HISTORY') {
      fetchReceivings();
    }
  }, [subTab, historyStatusFilter]);

  // Calculate grand total cost across form rows
  const calculatedGrandTotal = useMemo(() => {
    return receivingRows.reduce((acc, row) => {
      const qty = parseFloat(row.quantity) || 0;
      const cost = parseFloat(row.unitCost) || 0;
      return acc + (qty * cost);
    }, 0);
  }, [receivingRows]);

  // Download Sample Shipment Template CSV
  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        ItemName: 'Chicken Breast',
        SKU: 'RAW-CHK-001',
        Quantity: 20,
        Unit: 'KG',
        UnitCost: 850,
        BatchNumber: 'CHK-1026-A',
        ExpiryDate: '2026-10-15'
      },
      {
        ItemName: 'Mozzarella Cheese',
        SKU: 'RAW-CHS-001',
        Quantity: 10,
        Unit: 'KG',
        UnitCost: 1200,
        BatchNumber: 'CHS-1026-A',
        ExpiryDate: '2026-10-25'
      },
      {
        ItemName: 'Cooking Oil',
        SKU: 'RAW-OIL-001',
        Quantity: 15,
        Unit: 'L',
        UnitCost: 650,
        BatchNumber: 'OIL-1026-A',
        ExpiryDate: ''
      }
    ];

    exportToCSV('zovikpos_stock_shipment_template.csv', sampleData, [
      { key: 'ItemName', label: 'Item Name' },
      { key: 'SKU', label: 'SKU' },
      { key: 'Quantity', label: 'Quantity' },
      { key: 'Unit', label: 'Unit' },
      { key: 'UnitCost', label: 'Unit Cost' },
      { key: 'BatchNumber', label: 'Batch Number' },
      { key: 'ExpiryDate', label: 'Expiry Date' }
    ]);
  };

  // Add new row to form
  const handleAddRow = () => {
    const firstItem = inventory.length > 0 ? inventory[0] : null;
    setReceivingRows([
      ...receivingRows,
      {
        inventoryItemId: firstItem ? firstItem.id : '',
        quantity: 1,
        unit: firstItem ? firstItem.unit : 'PCS',
        unitCost: firstItem ? (firstItem.costPrice || 0) : 0,
        batchNumber: '',
        expiryDate: '',
        notes: ''
      }
    ]);
  };

  // Remove row from form
  const handleRemoveRow = (index) => {
    if (receivingRows.length === 1) {
      if (showToast) showToast('Receiving must contain at least one item row.', 'error');
      return;
    }
    const updated = [...receivingRows];
    updated.splice(index, 1);
    setReceivingRows(updated);
  };

  // Handle row field updates
  const handleRowChange = (index, field, value) => {
    const updated = [...receivingRows];
    updated[index][field] = value;

    if (field === 'inventoryItemId') {
      const invItem = inventory.find(i => String(i.id) === String(value));
      if (invItem) {
        updated[index].unit = invItem.unit || 'PCS';
        if (!updated[index].unitCost || updated[index].unitCost === 0) {
          updated[index].unitCost = invItem.costPrice || 0;
        }
      }
    }

    setReceivingRows(updated);
  };

  // Submit Receiving Document (DRAFT or RECEIVED)
  const handleSubmitReceiving = async (targetStatus) => {
    if (receivingRows.length === 0) {
      if (showToast) showToast('Please add at least one item to receive stock.', 'error');
      return;
    }

    for (let i = 0; i < receivingRows.length; i++) {
      const r = receivingRows[i];
      if (!r.inventoryItemId) {
        if (showToast) showToast(`Item row #${i + 1} has no inventory item selected.`, 'error');
        return;
      }
      if (parseFloat(r.quantity) <= 0) {
        if (showToast) showToast(`Item row #${i + 1} quantity must be greater than zero.`, 'error');
        return;
      }
    }

    const itemIds = receivingRows.map(r => r.inventoryItemId);
    const hasDuplicates = new Set(itemIds).size !== itemIds.length;
    if (hasDuplicates) {
      const confirmMerge = window.confirm('Duplicate items detected in receiving list. Proceed with separate row updates?');
      if (!confirmMerge) return;
    }

    setLoading(true);
    try {
      const payload = {
        supplierId: supplierId ? parseInt(supplierId, 10) : null,
        branchId: branchId ? parseInt(branchId, 10) : 1,
        invoiceNumber,
        receivingDate,
        notes,
        status: targetStatus,
        items: receivingRows.map(r => ({
          inventoryItemId: parseInt(r.inventoryItemId, 10),
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          unitCost: parseFloat(r.unitCost) || 0,
          batchNumber: r.batchNumber || null,
          expiryDate: r.expiryDate || null,
          notes: r.notes || null
        }))
      };

      const res = await api.post('/inventory/receivings', payload);
      if (showToast) {
        showToast(res.data?.message || 'Stock receiving processed successfully!');
      }

      // Reset Form
      setInvoiceNumber('');
      setNotes('');
      setReceivingRows([
        {
          inventoryItemId: inventory.length > 0 ? inventory[0].id : '',
          quantity: 1,
          unit: inventory.length > 0 ? inventory[0].unit : 'KG',
          unitCost: inventory.length > 0 ? (inventory[0].costPrice || 0) : 0,
          batchNumber: '',
          expiryDate: '',
          notes: ''
        }
      ]);

      if (onRefresh) onRefresh();
      setSubTab('HISTORY');
    } catch (err) {
      console.error('Submit receiving error:', err);
      if (showToast) showToast(err.response?.data?.error || 'Failed to submit stock receiving', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Confirm existing Draft
  const handleConfirmDraft = async (receivingId) => {
    setLoading(true);
    try {
      const res = await api.post(`/inventory/receivings/${receivingId}/receive`);
      if (showToast) showToast(res.data?.message || 'Draft confirmed and stock updated!');
      fetchReceivings();
      if (onRefresh) onRefresh();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to confirm draft', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel existing Draft
  const handleCancelDraft = async (receivingId) => {
    if (!window.confirm('Are you sure you want to cancel this draft receiving record?')) return;
    setLoading(true);
    try {
      const res = await api.post(`/inventory/receivings/${receivingId}/cancel`);
      if (showToast) showToast(res.data?.message || 'Receiving draft cancelled.');
      fetchReceivings();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to cancel draft', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- CSV / EXCEL FILE SELECTION & UPLOAD ---
  const handleCsvFileSelect = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      if (showToast) showToast('Invalid file format. Please upload a .csv, .xlsx, or .xls file.', 'error');
      return;
    }

    setCsvFile(file);
    setParsingCsv(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target.result.split(',')[1];
        try {
          const res = await api.post('/inventory/receivings/import/preview', {
            fileBase64: base64Content,
            fileName: file.name
          });
          if (res.data) setImportPreview(res.data);
        } catch (err) {
          if (showToast) showToast('Failed to parse file contents on server.', 'error');
        } finally {
          setParsingCsv(false);
        }
      };

      if (ext === 'csv') {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setParsingCsv(false);
      if (showToast) showToast('Error reading uploaded file.', 'error');
    }
  };

  // Parse Text fallback CSV
  const handleParseRawCsvText = async () => {
    if (!rawCsvText.trim()) {
      if (showToast) showToast('Please paste CSV text or select a file.', 'error');
      return;
    }
    setParsingCsv(true);
    try {
      const res = await api.post('/inventory/receivings/import/preview', { rawText: rawCsvText });
      if (res.data) setImportPreview(res.data);
    } catch (err) {
      if (showToast) showToast('Failed to parse CSV text.', 'error');
    } finally {
      setParsingCsv(false);
    }
  };

  // Manual Item Match Handler for Unmatched Rows
  const handleManualMatchUnmatchedItem = (unmatchedIndex, selectedInvId) => {
    if (!importPreview) return;
    const selectedInvItem = inventory.find(i => String(i.id) === String(selectedInvId));
    if (!selectedInvItem) return;

    const unmatchedTarget = importPreview.unmatchedItems[unmatchedIndex];
    const newMatchedItem = {
      inventoryItemId: selectedInvItem.id,
      name: selectedInvItem.name,
      category: selectedInvItem.category,
      sku: selectedInvItem.sku,
      currentStock: selectedInvItem.stockLevel,
      systemUnit: selectedInvItem.unit,
      quantity: unmatchedTarget.quantity,
      unit: unmatchedTarget.unit || selectedInvItem.unit,
      unitCost: unmatchedTarget.unitCost || selectedInvItem.costPrice,
      totalCost: unmatchedTarget.quantity * (unmatchedTarget.unitCost || selectedInvItem.costPrice),
      batchNumber: unmatchedTarget.batchNumber || null,
      expiryDate: unmatchedTarget.expiryDate || null,
      confidence: 1.0,
      status: 'MATCHED'
    };

    const updatedUnmatched = [...importPreview.unmatchedItems];
    updatedUnmatched.splice(unmatchedIndex, 1);

    const updatedMatched = [...importPreview.matchedItems, newMatchedItem];

    setImportPreview({
      ...importPreview,
      matchedItems: updatedMatched,
      unmatchedItems: updatedUnmatched,
      summary: {
        ...importPreview.summary,
        matchedCount: updatedMatched.length,
        unmatchedCount: updatedUnmatched.length
      }
    });

    if (showToast) showToast(`Matched "${unmatchedTarget.rawName}" to "${selectedInvItem.name}".`);
  };

  // Apply CSV / Excel Preview Rows to Form
  const handleApplyImportToForm = (previewObj) => {
    const previewToUse = previewObj || importPreview;
    if (!previewToUse || (!previewToUse.matchedItems.length && !previewToUse.unmatchedItems.length)) {
      if (showToast) showToast('No items available to import into receiving form.', 'error');
      return;
    }

    if (previewToUse.unmatchedItems && previewToUse.unmatchedItems.length > 0) {
      const confirmProceed = window.confirm(`There are ${previewToUse.unmatchedItems.length} unmatched item(s). Proceed with importing matched items only?`);
      if (!confirmProceed) return;
    }

    const newRows = previewToUse.matchedItems.map(m => ({
      inventoryItemId: m.inventoryItemId,
      quantity: m.quantity,
      unit: m.unit,
      unitCost: m.unitCost,
      batchNumber: m.batchNumber || '',
      expiryDate: m.expiryDate || '',
      notes: `Imported from ${previewToUse.fileName || 'file'}`
    }));

    setReceivingRows(newRows);
    if (previewToUse.invoiceNumber) setInvoiceNumber(previewToUse.invoiceNumber);
    
    setShowCsvModal(false);
    setShowOcrModal(false);
    setCsvFile(null);
    setOcrFile(null);
    setImportPreview(null);
    setOcrPreview(null);
    if (showToast) showToast(`Loaded ${newRows.length} matched items into receiving voucher form.`);
  };

  // --- AI / OCR INVOICE UPLOAD HANDLER ---
  const handleOcrFileSelect = async (file) => {
    if (!file) return;
    setOcrFile(file);
    setExtractingOcr(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target.result.split(',')[1];
        try {
          const res = await api.post('/inventory/receivings/ocr-preview', {
            fileBase64: base64Content,
            fileName: file.name
          });
          if (res.data) setOcrPreview(res.data);
        } catch (err) {
          if (showToast) showToast('Failed to extract invoice data on server.', 'error');
        } finally {
          setExtractingOcr(false);
        }
      };

      if (file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setExtractingOcr(false);
      if (showToast) showToast('Error reading uploaded invoice file.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Workflow Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/60 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-black text-[var(--text-main)] font-display">
              Multi-Item Stock Receiving Workflow
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Process bulk supplier stock shipments, upload spreadsheets/invoices, and record atomic inventory updates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSubTab('NEW_RECEIVING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'NEW_RECEIVING'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Receiving</span>
          </button>
          <button
            onClick={() => setSubTab('HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'HISTORY'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Receiving History</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: NEW MULTI-ITEM RECEIVING FORM */}
      {subTab === 'NEW_RECEIVING' && (
        <div className="space-y-6">
          {/* Input Method Chooser Banner */}
          <div className="bg-gradient-to-r from-orange-600/10 via-orange-500/5 to-transparent border border-orange-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-main)]">
                  Choose Receiving Method
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Add items manually, upload a CSV/Excel shipment file, or extract data from a supplier invoice image/PDF.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadSampleTemplate}
                className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500 text-[var(--text-main)] text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-orange-400" />
                <span>Sample Template</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCsvModal(true)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import CSV / Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOcrModal(true)}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upload Invoice (AI/OCR)</span>
              </button>
            </div>
          </div>

          {/* Header Metadata Inputs Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-main)] flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-orange-400" />
                <span>Shipment & Supplier Details</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-orange-500 transition-all"
                >
                  <option value="">-- Select Supplier (Optional) --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.contactPerson ? `(${s.contactPerson})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Branch
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-orange-500 transition-all"
                >
                  <option value="1">Main Campus Canteen Branch</option>
                  <option value="2">Block B Extension Branch</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Invoice / Reference #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-7842"
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Receiving Date
                </label>
                <input
                  type="date"
                  value={receivingDate}
                  onChange={(e) => setReceivingDate(e.target.value)}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Multi-Item Receiving Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-main)] flex items-center space-x-2">
                  <Package className="w-4 h-4 text-orange-400" />
                  <span>Received Inventory Items ({receivingRows.length})</span>
                </h4>
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="px-3.5 py-2 bg-orange-600/10 border border-orange-500/20 text-orange-400 hover:bg-orange-600/20 text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-extrabold bg-[var(--card-bg)]/40">
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-2 min-w-[200px]">Inventory Item</th>
                    <th className="py-3 px-2 w-28">Quantity</th>
                    <th className="py-3 px-2 w-24">Unit</th>
                    <th className="py-3 px-2 w-28">Unit Cost (Rs.)</th>
                    <th className="py-3 px-2 w-32">Subtotal (Rs.)</th>
                    <th className="py-3 px-2 w-32">Batch #</th>
                    <th className="py-3 px-2 w-36">Expiry Date</th>
                    <th className="py-3 px-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {receivingRows.map((row, idx) => {
                    const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0);

                    return (
                      <tr key={idx} className="hover:bg-[var(--card-bg)]/30 transition-colors">
                        <td className="py-3 px-2 font-bold text-[var(--text-muted)]">{idx + 1}</td>
                        
                        {/* Item Selector */}
                        <td className="py-3 px-2">
                          <select
                            value={row.inventoryItemId}
                            onChange={(e) => handleRowChange(idx, 'inventoryItemId', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          >
                            <option value="">-- Select Ingredient --</option>
                            {inventory.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} ({inv.category || 'General'} | Stock: {inv.stockLevel} {inv.unit})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2 py-1.5 text-xs font-bold text-[var(--text-main)] uppercase text-center focus:outline-none"
                          />
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.unitCost}
                            onChange={(e) => handleRowChange(idx, 'unitCost', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          />
                        </td>

                        {/* Row Subtotal */}
                        <td className="py-3 px-2 font-mono font-bold text-emerald-400">
                          Rs. {rowTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Batch Number */}
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            placeholder="e.g. CHK-1026"
                            value={row.batchNumber}
                            onChange={(e) => handleRowChange(idx, 'batchNumber', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          />
                        </td>

                        {/* Expiry Date */}
                        <td className="py-3 px-2">
                          <input
                            type="date"
                            value={row.expiryDate}
                            onChange={(e) => handleRowChange(idx, 'expiryDate', e.target.value)}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-2 py-1.5 text-[11px] text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          />
                        </td>

                        {/* Delete Row Button */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Notes & Summary Footer */}
            <div className="pt-4 border-t border-[var(--border-color)] grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-7 space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider block">
                  Receiving Notes / Remarks
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional receiving remarks, quality inspect notes, or delivery status..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-3 text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div className="md:col-span-5 bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)] font-semibold">Total Item Lines:</span>
                  <span className="font-extrabold text-[var(--text-main)] font-mono">{receivingRows.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-[var(--border-color)]">
                  <span className="font-extrabold text-[var(--text-main)] uppercase">Grand Total Cost:</span>
                  <span className="text-xl font-extrabold text-emerald-400 font-mono">
                    Rs. {calculatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmitReceiving('DRAFT')}
                    className="flex-1 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500 text-[var(--text-main)] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Save className="w-3.5 h-3.5 text-orange-400" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSubmitReceiving('RECEIVED')}
                    className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-orange-600/20 cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{loading ? 'Processing...' : 'Receive Stock'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: RECEIVING HISTORY */}
      {subTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search receiving vouchers by REC# or Invoice#..."
                className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 pl-10 text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-xs font-semibold text-[var(--text-main)] focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="RECEIVED">Confirmed (RECEIVED)</option>
                <option value="DRAFT">Draft Vouchers</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-extrabold bg-[var(--card-bg)]/60">
                    <th className="py-3 px-4">Receiving #</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Receiving Date</th>
                    <th className="py-3 px-4">Items Count</th>
                    <th className="py-3 px-4">Total Cost</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Received By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {receivingsList.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-[var(--text-muted)]">
                        No stock receiving records found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    receivingsList.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[var(--card-bg)]/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-extrabold text-orange-400">
                          {rec.receivingNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--text-main)]">
                          {rec.supplier?.name || 'General Supplier'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                          {rec.invoiceNumber || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)]">
                          {new Date(rec.receivingDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">
                          {rec.items?.length || rec._count?.items || 0} line items
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-emerald-400">
                          Rs. {(rec.totalCost || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              rec.status === 'RECEIVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : rec.status === 'DRAFT'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-muted)]">
                          {rec.receivedBy?.name || 'System Admin'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setSelectedReceiving(rec);
                                setShowDetailsModal(true);
                              }}
                              className="px-2.5 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-orange-500 text-[var(--text-main)] rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-orange-400" />
                              <span>View</span>
                            </button>

                            {rec.status === 'DRAFT' && (
                              <>
                                <button
                                  onClick={() => handleConfirmDraft(rec.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Receive</span>
                                </button>
                                <button
                                  onClick={() => handleCancelDraft(rec.id)}
                                  className="px-2 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: RECEIVING DETAILS MODAL */}
      {showDetailsModal && selectedReceiving && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] max-w-3xl w-full rounded-2xl shadow-2xl p-6 space-y-6 relative animate-fade-in my-8">
            <div className="flex justify-between items-start border-b border-[var(--border-color)] pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-extrabold font-mono text-orange-400">
                    {selectedReceiving.receivingNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      selectedReceiving.status === 'RECEIVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {selectedReceiving.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Stock Receiving Voucher Details & Atomic Inventory Log Impact
                </p>
              </div>

              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] block">Supplier</span>
                <span className="font-bold text-[var(--text-main)]">{selectedReceiving.supplier?.name || 'General Supplier'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] block">Invoice #</span>
                <span className="font-mono font-bold text-[var(--text-main)]">{selectedReceiving.invoiceNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] block">Receiving Date</span>
                <span className="font-bold text-[var(--text-main)]">{new Date(selectedReceiving.receivingDate).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--text-muted)] block">Received By</span>
                <span className="font-bold text-[var(--text-main)]">{selectedReceiving.receivedBy?.name || 'Admin'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
                Received Line Items ({selectedReceiving.items?.length || 0})
              </h5>

              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-extrabold border-b border-[var(--border-color)]">
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Unit Cost</th>
                      <th className="py-2.5 px-3">Total Cost</th>
                      <th className="py-2.5 px-3">Batch #</th>
                      <th className="py-2.5 px-3">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {selectedReceiving.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--card-bg)]/30">
                        <td className="py-2.5 px-3 font-bold text-[var(--text-main)]">
                          {item.inventoryItem?.name || `Item #${item.inventoryItemId}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          Rs. {item.unitCost}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-400">
                          Rs. {item.totalCost}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                          {item.batchNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)]">
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-muted)]">
                Total Valuation Impact:
              </span>
              <span className="text-xl font-black font-mono text-emerald-400">
                Rs. {(selectedReceiving.totalCost || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CSV / EXCEL FILE UPLOAD & PREVIEW MODAL */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] max-w-3xl w-full rounded-2xl shadow-2xl p-6 space-y-6 relative animate-fade-in my-8">
            <div className="flex justify-between items-start border-b border-[var(--border-color)] pb-3">
              <div>
                <h4 className="text-base font-extrabold text-[var(--text-main)] font-display flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Import Stock Shipment (CSV / Excel File Upload)</span>
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Upload a spreadsheet file (.csv, .xlsx, .xls) for automatic catalog matching and preview before confirmation.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setImportPreview(null);
                  setCsvFile(null);
                }}
                className="p-1 hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag & Drop File Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOverCsv(true); }}
              onDragLeave={() => setIsDragOverCsv(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverCsv(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleCsvFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
                isDragOverCsv
                  ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                  : 'border-[var(--border-color)] bg-[var(--bg-color)]/50 hover:border-emerald-500/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-[var(--text-main)]">
                  {csvFile ? `Selected File: ${csvFile.name}` : 'Drag & Drop CSV / Excel File Here'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Supported formats: <strong>.csv, .xlsx, .xls</strong> (Max file size 10MB)
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-all flex items-center space-x-1.5">
                  <FileUp className="w-4 h-4" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCsvFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3.5 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-emerald-500 text-[var(--text-main)] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Sample Template</span>
                </button>
              </div>
            </div>

            {/* Optional CSV Text Paste Fallback Accordion */}
            <details className="text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/30 rounded-xl p-3 border border-[var(--border-color)]">
              <summary className="cursor-pointer font-bold text-[var(--text-main)] flex items-center justify-between">
                <span>Optional: Paste Raw CSV Text Fallback</span>
                <HelpCircle className="w-3.5 h-3.5" />
              </summary>
              <div className="pt-3 space-y-2">
                <textarea
                  rows="3"
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  placeholder="Item Name, Quantity, Unit, Unit Cost, Batch Number, Expiry Date..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={parsingCsv}
                  onClick={handleParseRawCsvText}
                  className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 text-xs font-bold rounded-lg transition-all"
                >
                  Parse Text Payload
                </button>
              </div>
            </details>

            {/* Preview Results Table */}
            {parsingCsv && (
              <div className="py-6 text-center space-y-2">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs font-bold text-[var(--text-main)]">Reading file & matching inventory catalog...</p>
              </div>
            )}

            {importPreview && !parsingCsv && (
              <div className="space-y-4 pt-2 border-t border-[var(--border-color)]">
                {/* Summary Header */}
                <div className="grid grid-cols-3 gap-3 text-xs bg-[var(--bg-color)] p-3 rounded-xl border border-[var(--border-color)] text-center">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400 block">✓ Matched</span>
                    <strong className="text-sm font-mono text-[var(--text-main)]">{importPreview.summary.matchedCount} items</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 block">⚠ Needs Matching</span>
                    <strong className="text-sm font-mono text-[var(--text-main)]">{importPreview.summary.unmatchedCount} items</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400 block">Total Cost</span>
                    <strong className="text-sm font-mono text-emerald-400">Rs. {importPreview.summary.estimatedTotalCost.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Unmatched Items (Needs Manual Selector) */}
                {importPreview.unmatchedItems && importPreview.unmatchedItems.length > 0 && (
                  <div className="space-y-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                    <span className="text-xs font-extrabold text-amber-400 flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Action Required: Resolve Unmatched Items ({importPreview.unmatchedItems.length})</span>
                    </span>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {importPreview.unmatchedItems.map((unmatched, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 bg-[var(--card-bg)] rounded-lg text-xs">
                          <div>
                            <span className="font-bold text-[var(--text-main)]">Imported: "{unmatched.rawName}"</span>
                            <span className="text-[10px] text-[var(--text-muted)] block">Qty: {unmatched.quantity} {unmatched.unit} @ Rs. {unmatched.unitCost}</span>
                          </div>

                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <select
                              onChange={(e) => handleManualMatchUnmatchedItem(idx, e.target.value)}
                              className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-xs text-[var(--text-main)] focus:outline-none focus:border-amber-500"
                            >
                              <option value="">-- Match to Catalog Ingredient --</option>
                              {inventory.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.name} ({inv.category})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched list */}
                {importPreview.matchedItems.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      ✓ Ready Matched Catalog Items ({importPreview.matchedItems.length})
                    </span>
                    <div className="max-h-48 overflow-y-auto border border-[var(--border-color)] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[var(--bg-color)] text-[var(--text-muted)] text-[10px] uppercase font-extrabold border-b border-[var(--border-color)]">
                            <th className="py-2 px-3">Catalog Item</th>
                            <th className="py-2 px-3">Quantity</th>
                            <th className="py-2 px-3">Unit Cost</th>
                            <th className="py-2 px-3">Total</th>
                            <th className="py-2 px-3">Batch</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {importPreview.matchedItems.map((m, idx) => (
                            <tr key={idx} className="hover:bg-[var(--bg-color)]/30">
                              <td className="py-2 px-3 font-bold text-[var(--text-main)]">{m.name}</td>
                              <td className="py-2 px-3 font-mono">{m.quantity} {m.unit}</td>
                              <td className="py-2 px-3 font-mono">Rs. {m.unitCost}</td>
                              <td className="py-2 px-3 font-mono font-bold text-emerald-400">Rs. {m.totalCost}</td>
                              <td className="py-2 px-3 font-mono text-[var(--text-muted)]">{m.batchNumber || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCsvModal(false);
                      setImportPreview(null);
                      setCsvFile(null);
                    }}
                    className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyImportToForm(importPreview)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply & Transfer to Receiving Voucher</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: AI / OCR INVOICE FILE UPLOAD MODAL */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] max-w-3xl w-full rounded-2xl shadow-2xl p-6 space-y-6 relative animate-fade-in my-8">
            <div className="flex justify-between items-start border-b border-[var(--border-color)] pb-3">
              <div>
                <h4 className="text-base font-extrabold text-[var(--text-main)] font-display flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span>AI Invoice Extraction & Upload</span>
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Upload supplier invoice documents (PDF, JPG, PNG) to extract line items and match against catalog.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowOcrModal(false);
                  setOcrPreview(null);
                  setOcrFile(null);
                }}
                className="p-1 hover:bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drag & Drop Invoice File Upload Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOverOcr(true); }}
              onDragLeave={() => setIsDragOverOcr(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverOcr(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleOcrFileSelect(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
                isDragOverOcr
                  ? 'border-purple-500 bg-purple-500/10 scale-[1.01]'
                  : 'border-[var(--border-color)] bg-[var(--bg-color)]/50 hover:border-purple-500/50'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-[var(--text-main)]">
                  {ocrFile ? `Invoice File: ${ocrFile.name}` : 'Drag & Drop Supplier Invoice File Here'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Supported formats: <strong>PDF, JPG, JPEG, PNG, TXT</strong>
                </p>
              </div>

              <label className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-all flex items-center space-x-1.5">
                <FileUp className="w-4 h-4" />
                <span>Upload Invoice File</span>
                <input
                  type="file"
                  accept=".pdf, .jpg, .jpeg, .png, .txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleOcrFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {/* Optional Raw Text Input Fallback Accordion */}
            <details className="text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/30 rounded-xl p-3 border border-[var(--border-color)]">
              <summary className="cursor-pointer font-bold text-[var(--text-main)] flex items-center justify-between">
                <span>Optional: Paste Raw Invoice Text Payload</span>
                <HelpCircle className="w-3.5 h-3.5" />
              </summary>
              <div className="pt-3 space-y-2">
                <textarea
                  rows="3"
                  value={rawOcrText}
                  onChange={(e) => setRawOcrText(e.target.value)}
                  placeholder="Invoice #: INV-9942\nChicken Breast, 20, KG, 850..."
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl p-2.5 text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  disabled={extractingOcr}
                  onClick={async () => {
                    if (!rawOcrText.trim()) return;
                    setExtractingOcr(true);
                    try {
                      const res = await api.post('/inventory/receivings/ocr-preview', { rawText: rawOcrText });
                      if (res.data) setOcrPreview(res.data);
                    } catch (e) {
                      if (showToast) showToast('AI OCR extraction error.', 'error');
                    } finally {
                      setExtractingOcr(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-xs font-bold rounded-lg transition-all"
                >
                  Extract Text Payload
                </button>
              </div>
            </details>

            {/* AI Extraction Loading State */}
            {extractingOcr && (
              <div className="py-6 text-center space-y-2">
                <Sparkles className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
                <p className="text-xs font-bold text-[var(--text-main)]">Extracting line items & matching catalog via AI...</p>
              </div>
            )}

            {/* AI Preview Results */}
            {ocrPreview && !extractingOcr && (
              <div className="space-y-4 pt-2 border-t border-[var(--border-color)]">
                <div className="flex justify-between items-center text-xs bg-[var(--bg-color)] p-3 rounded-xl border border-[var(--border-color)]">
                  <span>Detected Invoice: <strong className="text-purple-400 font-mono">{ocrPreview.invoiceNumber}</strong></span>
                  <span>Extracted Matched: <strong className="text-purple-400 font-mono">{ocrPreview.matchedItems?.length || 0} items</strong></span>
                </div>

                {ocrPreview.matchedItems?.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                      ✓ Extracted Items for Verification
                    </span>
                    <div className="max-h-48 overflow-y-auto border border-[var(--border-color)] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[var(--bg-color)] text-[var(--text-muted)] text-[10px] uppercase font-extrabold border-b border-[var(--border-color)]">
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3">Quantity</th>
                            <th className="py-2 px-3">Unit Cost</th>
                            <th className="py-2 px-3">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {ocrPreview.matchedItems.map((m, idx) => (
                            <tr key={idx} className="hover:bg-[var(--bg-color)]/30">
                              <td className="py-2 px-3 font-bold text-[var(--text-main)]">{m.name}</td>
                              <td className="py-2 px-3 font-mono">{m.quantity} {m.unit}</td>
                              <td className="py-2 px-3 font-mono">Rs. {m.unitCost}</td>
                              <td className="py-2 px-3 font-mono font-bold text-purple-400">Rs. {m.totalCost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOcrModal(false);
                      setOcrPreview(null);
                      setOcrFile(null);
                    }}
                    className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyImportToForm(ocrPreview)}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Extracted Items to Form</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryReceivingView;

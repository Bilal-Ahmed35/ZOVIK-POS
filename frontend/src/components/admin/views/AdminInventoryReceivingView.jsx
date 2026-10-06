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
  Edit3,
  Camera,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  Sparkle
} from 'lucide-react';
import api from '../../../services/api';
import { exportToCSV } from '../../../utils/exportUtils';

// Common local Urdu / Roman Urdu search aliases map for inventory lookup
const ITEM_ALIASES = {
  'aloo': ['potatoes', 'potato', 'fresh potatoes'],
  'pyaz': ['onions', 'onion', 'pyaaz'],
  'tamatar': ['tomatoes', 'tomato'],
  'doodh': ['milk', 'fresh milk'],
  'anda': ['eggs', 'egg', 'anday', 'fresh eggs'],
  'adrak': ['ginger'],
  'lehsan': ['garlic', 'lahsan'],
  'hari mirch': ['green chillies', 'green chili'],
  'dahi': ['yogurt', 'curd'],
  'makhan': ['butter'],
  'aata': ['wheat flour', 'flour'],
  'maida': ['refined flour', 'all-purpose flour'],
  'besan': ['gram flour'],
  'chawal': ['rice', 'basmati rice'],
  'keema': ['mince', 'beef mince', 'chicken mince'],
  'qima': ['mince', 'beef mince'],
  'qeema': ['mince'],
  'murghi': ['chicken'],
  'gosht': ['mutton', 'beef', 'meat'],
  'tel': ['cooking oil', 'oil'],
  'namak': ['salt'],
  'haldi': ['turmeric', 'turmeric powder'],
  'lal mirch': ['red chilli', 'chilli powder'],
  'zeera': ['cumin seeds', 'cumin'],
  'chai': ['tea leaves', 'tea'],
  'cheeni': ['sugar']
};

const PERISHABLE_CATEGORIES = ['Meat / Protein', 'Dairy', 'Vegetables', 'Beverages', 'Desserts'];

// Normalize unit string
const normalizeUnit = (unitStr) => {
  if (!unitStr) return 'KG';
  const u = String(unitStr).trim().toUpperCase();
  if (['KGS', 'KG', 'KILOGRAM', 'KILOGRAMS', 'KILO', 'KILOS'].includes(u)) return 'KG';
  if (['G', 'GM', 'GMS', 'GRAM', 'GRAMS'].includes(u)) return 'G';
  if (['L', 'LTR', 'LTRS', 'LITER', 'LITERS', 'LITRE', 'LITRES'].includes(u)) return 'L';
  if (['ML', 'MILLILITER', 'MILLILITERS'].includes(u)) return 'ML';
  if (['PCS', 'PC', 'PIECE', 'PIECES', 'ITEM', 'ITEMS', 'PKT', 'PKTS'].includes(u)) return 'PCS';
  if (['DOZEN', 'DOZ', 'DOZENS'].includes(u)) return 'DOZEN';
  if (['BOX', 'BOXES', 'CTN', 'CARTON', 'CARTONS'].includes(u)) return 'BOX';
  if (['PACK', 'PACKET', 'PACKETS', 'BAG', 'BAGS'].includes(u)) return 'PACK';
  if (['BOTTLE', 'BOTTLES', 'BOT'].includes(u)) return 'BOTTLE';
  return u;
};

const AdminInventoryReceivingView = ({ inventory = [], suppliers = [], onRefresh, showToast, onNavigateToCatalog }) => {
  const [subTab, setSubTab] = useState('NEW_RECEIVING'); // NEW_RECEIVING | HISTORY
  const [receivingMethod, setReceivingMethod] = useState('MANUAL'); // MANUAL | EXCEL | INVOICE
  const [loading, setLoading] = useState(false);
  const [receivingsList, setReceivingsList] = useState([]);
  
  // Header Form State
  const [receivingRef, setReceivingRef] = useState(''); // Internal System Reference RCV-YYYYMMDD-XXX
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(''); // External Supplier Invoice # (e.g. INV-45892)
  const [branchId, setBranchId] = useState('1');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // AI Extracted Metadata
  const [aiDetectedSupplier, setAiDetectedSupplier] = useState('');
  const [aiDetectedInvoiceNumber, setAiDetectedInvoiceNumber] = useState('');
  const [aiDetectedInvoiceTotal, setAiDetectedInvoiceTotal] = useState(null);

  // Success Screen State
  const [completedReceiving, setCompletedReceiving] = useState(null);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Multi-item stacked review cards array
  const [receivingRows, setReceivingRows] = useState([
    {
      inventoryItemId: '',
      searchTerm: '',
      showSearchDropdown: false,
      quantity: 1,
      unit: 'KG',
      unitCost: 0,
      batchNumber: '',
      expiryDate: '',
      notes: '',
      showMoreDetails: false,
      isAiDetected: false,
      confidence: 1.0,
      isUnmatched: false
    }
  ]);

  // Selected Receiving for Details Modal
  const [selectedReceiving, setSelectedReceiving] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // CSV / EXCEL Upload & Processing State
  const [parsingCsv, setParsingCsv] = useState(false);

  // AI / OCR INVOICE STATE
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [extractingOcr, setExtractingOcr] = useState(false);

  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  // Generate dynamic internal receiving reference RCV-YYYYMMDD-XXX
  const generateAutoRef = async () => {
    try {
      const res = await api.get('/inventory/receivings/next-ref');
      if (res.data?.reference) {
        setReceivingRef(res.data.reference);
      }
    } catch (err) {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      setReceivingRef(`RCV-${dateStr}-001`);
    }
  };

  // Generate Auto-Reference on Mount and Reset
  useEffect(() => {
    generateAutoRef();
  }, []);

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

  // Download Easy 4-Column Excel Template
  const handleDownloadEasyExcelTemplate = () => {
    const templateData = [
      { 'Item Name': 'Potatoes', 'Quantity': 50, 'Unit': 'KG', 'Cost per Unit': 120 },
      { 'Item Name': 'Onions', 'Quantity': 30, 'Unit': 'KG', 'Cost per Unit': 100 },
      { 'Item Name': 'Chicken Fillet', 'Quantity': 25, 'Unit': 'KG', 'Cost per Unit': 650 },
      { 'Item Name': 'Burger Buns', 'Quantity': 100, 'Unit': 'PCS', 'Cost per Unit': 45 },
      { 'Item Name': 'Cooking Oil', 'Quantity': 10, 'Unit': 'L', 'Cost per Unit': 550 }
    ];

    exportToCSV('Easy_Stock_Receiving_Template.csv', templateData, [
      { key: 'Item Name', label: 'Item Name' },
      { key: 'Quantity', label: 'Quantity' },
      { key: 'Unit', label: 'Unit' },
      { key: 'Cost per Unit', label: 'Cost per Unit' }
    ]);

    if (showToast) {
      showToast('Downloaded Easy Excel Format template!');
    }
  };

  // Calculate grand total cost across item rows
  const calculatedGrandTotal = useMemo(() => {
    return receivingRows.reduce((acc, row) => {
      const qty = parseFloat(row.quantity) || 0;
      const cost = parseFloat(row.unitCost) || 0;
      return acc + (qty * cost);
    }, 0);
  }, [receivingRows]);

  // Total valid items count
  const validItemsCount = useMemo(() => {
    return receivingRows.filter(r => r.inventoryItemId).length;
  }, [receivingRows]);

  // Add a new blank item row
  const handleAddRow = () => {
    setReceivingRows(prev => [
      ...prev,
      {
        inventoryItemId: '',
        searchTerm: '',
        showSearchDropdown: false,
        quantity: 1,
        unit: 'KG',
        unitCost: 0,
        batchNumber: '',
        expiryDate: '',
        notes: '',
        showMoreDetails: false,
        isAiDetected: false,
        confidence: 1.0,
        isUnmatched: false
      }
    ]);
  };

  // Remove row
  const handleRemoveRow = (index) => {
    if (receivingRows.length === 1) {
      if (showToast) showToast('Receiving record must contain at least one item.', 'error');
      return;
    }
    setReceivingRows(prev => prev.filter((_, idx) => idx !== index));
  };

  // Select item from autocomplete dropdown
  const handleSelectItem = (index, invItem) => {
    setReceivingRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventoryItemId: String(invItem.id),
        searchTerm: invItem.name,
        showSearchDropdown: false,
        unit: invItem.unit || 'KG',
        unitCost: invItem.costPrice || 0,
        isUnmatched: false
      };
      return updated;
    });
  };

  // Handle row field updates
  const handleRowChange = (index, field, value) => {
    setReceivingRows(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  // Process Excel/CSV Upload directly & populate Review Stock rows
  const handleExcelUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      if (showToast) showToast('Invalid file format. Upload a .csv, .xlsx, or .xls file.', 'error');
      return;
    }

    setParsingCsv(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await api.post('/inventory/receivings/import/preview', {
            fileBase64: e.target.result,
            fileName: file.name
          });

          if (res.data) {
            const rawMatched = res.data.matchedItems || [];
            const rawUnmatched = res.data.unmatchedItems || [];
            
            // Map rows and combine duplicate items with exact same cost
            const rowMap = new Map();
            const processRow = (raw, isMatched) => {
              const nameKey = (raw.name || raw.matchedName || raw.rawName || '').toLowerCase().trim();
              const unitKey = normalizeUnit(raw.unit || raw.systemUnit);
              const costKey = parseFloat(raw.unitCost) || 0;
              const mapId = `${nameKey}_${costKey}`;

              if (rowMap.has(mapId)) {
                const existing = rowMap.get(mapId);
                existing.quantity = parseFloat(existing.quantity) + (parseFloat(raw.quantity) || 0);
              } else {
                rowMap.set(mapId, {
                  inventoryItemId: raw.inventoryItemId ? String(raw.inventoryItemId) : '',
                  searchTerm: raw.name || raw.matchedName || raw.rawName,
                  showSearchDropdown: false,
                  quantity: parseFloat(raw.quantity) || 1,
                  unit: unitKey,
                  unitCost: costKey,
                  batchNumber: raw.batchNumber || '',
                  expiryDate: raw.expiryDate ? new Date(raw.expiryDate).toISOString().split('T')[0] : '',
                  notes: '',
                  showMoreDetails: !!(raw.batchNumber || raw.expiryDate),
                  isAiDetected: false,
                  confidence: raw.confidence || 0.9,
                  isUnmatched: !isMatched
                });
              }
            };

            rawMatched.forEach(m => processRow(m, true));
            rawUnmatched.forEach(u => processRow(u, false));

            const newRows = Array.from(rowMap.values());

            if (newRows.length === 0) {
              if (showToast) showToast('No valid items found in the Excel file.', 'error');
            } else {
              setReceivingRows(newRows);
              setReceivingMethod('MANUAL'); // Switch to Review Stock screen
              if (showToast) {
                showToast(`Processed ${newRows.length} items from Excel file into Review Stock!`);
              }
            }
          }
        } catch (err) {
          if (showToast) showToast('Failed to parse Excel file contents.', 'error');
        } finally {
          setParsingCsv(false);
        }
      };

      if (ext === 'csv') reader.readAsText(file);
      else reader.readAsDataURL(file);
    } catch (err) {
      setParsingCsv(false);
      if (showToast) showToast('Error reading uploaded Excel file.', 'error');
    }
  };

  // --- AI / OCR Invoice Upload & Field Extraction ---
  const handleOcrFileSelect = async (file) => {
    if (!file) return;
    setOcrFile(file);
    setExtractingOcr(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const selectedSup = suppliers.find(s => String(s.id) === String(supplierId));
          const res = await api.post('/inventory/receivings/ocr-preview', {
            fileBase64: e.target.result,
            fileName: file.name,
            supplierName: selectedSup ? selectedSup.name : ''
          });

          if (res.data) {
            // Extract metadata
            if (res.data.supplierName) {
              setAiDetectedSupplier(res.data.supplierName);
              const matchedSup = suppliers.find(s => 
                s.name.toLowerCase().includes(res.data.supplierName.toLowerCase()) ||
                res.data.supplierName.toLowerCase().includes(s.name.toLowerCase())
              );
              if (matchedSup) {
                setSupplierId(String(matchedSup.id));
              }
            }

            if (res.data.invoiceNumber) {
              setSupplierInvoiceNumber(res.data.invoiceNumber);
              setAiDetectedInvoiceNumber(res.data.invoiceNumber);
            }

            if (res.data.summary?.estimatedTotalCost) {
              setAiDetectedInvoiceTotal(res.data.summary.estimatedTotalCost);
            }

            // Extract item rows with AI badges
            const rawMatched = res.data.matchedItems || [];
            const rawUnmatched = res.data.unmatchedItems || [];

            const newRows = [];
            const processOcrItem = (item, isMatched) => {
              newRows.push({
                inventoryItemId: item.inventoryItemId ? String(item.inventoryItemId) : '',
                searchTerm: item.matchedName || item.name || item.rawName || item.rawScannedName,
                showSearchDropdown: false,
                quantity: parseFloat(item.quantity) || 1,
                unit: normalizeUnit(item.unit || item.systemUnit),
                unitCost: parseFloat(item.unitCost) || 0,
                batchNumber: item.batchNumber || '',
                expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
                notes: '',
                showMoreDetails: !!(item.batchNumber || item.expiryDate),
                isAiDetected: true,
                confidence: item.confidence || 0.85,
                isUnmatched: !isMatched
              });
            };

            rawMatched.forEach(m => processOcrItem(m, true));
            rawUnmatched.forEach(u => processOcrItem(u, false));

            if (newRows.length > 0) {
              setReceivingRows(newRows);
              setShowOcrModal(false);
              setReceivingMethod('MANUAL'); // Direct to unified Review Stock
              if (showToast) {
                showToast(`AI extracted ${newRows.length} items from invoice for review!`);
              }
            }
          }
        } catch (err) {
          if (showToast) showToast('Failed to process invoice OCR with AI.', 'error');
        } finally {
          setExtractingOcr(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setExtractingOcr(false);
      if (showToast) showToast('Error reading invoice file.', 'error');
    }
  };

  // Initiate Stock Receive
  const handleInitiateSubmit = (targetStatus) => {
    if (receivingRows.length === 0) {
      if (showToast) showToast('Please select at least one item to receive.', 'error');
      return;
    }

    for (let i = 0; i < receivingRows.length; i++) {
      const r = receivingRows[i];
      if (!r.inventoryItemId) {
        if (showToast) showToast(`Item #${i + 1} ("${r.searchTerm}") is not matched to catalog. Please choose an item.`, 'error');
        return;
      }
      if (!r.quantity || parseFloat(r.quantity) <= 0) {
        if (showToast) showToast(`Please enter a quantity greater than 0 for Item #${i + 1}.`, 'error');
        return;
      }
    }

    if (targetStatus === 'RECEIVED') {
      setShowConfirmModal(true);
    } else {
      executeSubmitReceiving('DRAFT');
    }
  };

  // Final Submit Action
  const executeSubmitReceiving = async (targetStatus) => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      const payload = {
        supplierId: supplierId ? parseInt(supplierId, 10) : null,
        branchId: branchId ? parseInt(branchId, 10) : 1,
        receivingRef: receivingRef.trim(), // Internal RCV-20261006-001
        invoiceNumber: supplierInvoiceNumber.trim() || null, // External Supplier INV #
        receivingDate,
        notes: notes ? String(notes).trim() : null,
        status: targetStatus,
        items: receivingRows.map(r => ({
          inventoryItemId: parseInt(r.inventoryItemId, 10),
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          unitCost: parseFloat(r.unitCost) || 0,
          batchNumber: r.batchNumber ? String(r.batchNumber).trim() : null,
          expiryDate: r.expiryDate || null,
          notes: r.notes ? String(r.notes).trim() : null
        }))
      };

      const res = await api.post('/inventory/receivings', payload);
      
      const record = {
        receivingRef,
        supplierName: suppliers.find(s => String(s.id) === String(supplierId))?.name || 'Local Market / Not Provided',
        invoiceNumber: supplierInvoiceNumber || 'Not Provided',
        itemCount: validItemsCount,
        totalCost: calculatedGrandTotal
      };

      setCompletedReceiving(record);

      if (showToast) {
        showToast(res.data?.message || 'Stock received successfully and inventory updated!');
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Submit receiving error:', err);
      if (showToast) showToast(err.response?.data?.error || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset receiving form for next receiving
  const handleResetForNewReceiving = () => {
    setCompletedReceiving(null);
    setSupplierInvoiceNumber('');
    setAiDetectedSupplier('');
    setAiDetectedInvoiceNumber('');
    setAiDetectedInvoiceTotal(null);
    setNotes('');
    generateAutoRef();
    setReceivingRows([
      {
        inventoryItemId: '',
        searchTerm: '',
        showSearchDropdown: false,
        quantity: 1,
        unit: 'KG',
        unitCost: 0,
        batchNumber: '',
        expiryDate: '',
        notes: '',
        showMoreDetails: false,
        isAiDetected: false,
        confidence: 1.0,
        isUnmatched: false
      }
    ]);
  };

  // Confirm existing Draft from History
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

  return (
    <div className="space-y-6">
      
      {/* Upper Navigation & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)] p-4 sm:p-5 rounded-3xl border border-[var(--border-color)] shadow-sm">
        <div>
          <h2 className="text-xl font-black text-[var(--text-main)] font-display flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-orange-500/10 text-orange-400">📥</span>
            Receive Stock
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Log incoming inventory items, verify purchase costs, and update stock balances.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => { setSubTab('NEW_RECEIVING'); setCompletedReceiving(null); }}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 border ${
              subTab === 'NEW_RECEIVING'
                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Receiving</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('HISTORY')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 border ${
              subTab === 'HISTORY'
                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Receiving History</span>
          </button>
        </div>
      </div>

      {subTab === 'NEW_RECEIVING' && (
        <div>
          {/* SUCCESS SCREEN */}
          {completedReceiving ? (
            <div className="bg-[var(--card-bg)] border-2 border-emerald-500/40 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-scale-up max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black text-[var(--text-main)] font-display">Stock Received Successfully!</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Inventory balances have been updated and purchase costs recorded.
                </p>
              </div>

              <div className="bg-[var(--bg-color)]/60 border border-[var(--border-color)] p-4 rounded-2xl space-y-2 text-xs text-left font-medium">
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                  <span className="text-[var(--text-muted)]">Receiving Reference:</span>
                  <span className="font-mono font-bold text-orange-400">{completedReceiving.receivingRef}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                  <span className="text-[var(--text-muted)]">Supplier:</span>
                  <span className="font-bold text-[var(--text-main)]">{completedReceiving.supplierName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                  <span className="text-[var(--text-muted)]">Supplier Invoice #:</span>
                  <span className="font-mono font-semibold text-[var(--text-main)]">{completedReceiving.invoiceNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                  <span className="text-[var(--text-muted)]">Items Added:</span>
                  <span className="font-bold text-orange-400">{completedReceiving.itemCount} items</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[var(--text-muted)]">Total Cost:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">Rs. {completedReceiving.totalCost.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setSubTab('HISTORY')}
                  className="px-5 py-3 rounded-2xl bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:border-orange-500/50 cursor-pointer"
                >
                  View Receiving Records
                </button>
                {onNavigateToCatalog && (
                  <button
                    type="button"
                    onClick={onNavigateToCatalog}
                    className="px-5 py-3 rounded-2xl bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:border-orange-500/50 cursor-pointer"
                  >
                    View Inventory Catalog
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetForNewReceiving}
                  className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow-lg shadow-orange-600/20 cursor-pointer"
                >
                  Receive More Stock
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Section 1: Receiving Method Cards */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                    1. Choose Receiving Method
                  </label>
                  <span className="text-[10px] text-orange-400 font-semibold">
                    ✨ All methods use the same smart review & validation system
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Method 1: Add Items Manually */}
                  <button
                    type="button"
                    onClick={() => setReceivingMethod('MANUAL')}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center space-x-3 cursor-pointer ${
                      receivingMethod === 'MANUAL'
                        ? 'bg-orange-500/10 border-orange-500 text-orange-400 ring-2 ring-orange-500/20'
                        : 'bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-orange-500/50'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400 shrink-0">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-main)]">Add Items Manually</h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Enter items and quantities using touch-friendly form.</p>
                    </div>
                  </button>

                  {/* Method 2: Upload Excel / CSV */}
                  <button
                    type="button"
                    onClick={() => setReceivingMethod('EXCEL')}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center space-x-3 cursor-pointer ${
                      receivingMethod === 'EXCEL'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-emerald-500/50'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-main)]">Upload Excel / CSV</h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Upload stock Excel file and auto-match catalog items.</p>
                    </div>
                  </button>

                  {/* Method 3: Upload Invoice (AI / OCR) */}
                  <button
                    type="button"
                    onClick={() => {
                      setReceivingMethod('INVOICE');
                      setShowOcrModal(true);
                    }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center space-x-3 cursor-pointer ${
                      receivingMethod === 'INVOICE'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 ring-2 ring-purple-500/20'
                        : 'bg-[var(--bg-color)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-purple-500/50'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-main)]">Upload Invoice</h4>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Upload paper bill, image, or PDF for AI recognition.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Excel Dropzone Panel */}
              {receivingMethod === 'EXCEL' && (
                <div className="bg-[var(--card-bg)] border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm animate-scale-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[var(--border-color)] pb-3">
                    <div>
                      <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        Upload Stock from Excel
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Use our simple 4-column format. The system reads and auto-matches items into Review Stock.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadEasyExcelTemplate}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center space-x-2 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Easy Excel Format</span>
                    </button>
                  </div>

                  <div className="p-6 rounded-2xl bg-[var(--bg-color)] border-2 border-dashed border-emerald-500/40 text-center space-y-3">
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={(e) => handleExcelUpload(e.target.files[0])}
                      className="hidden"
                      id="excelFileInputDirect"
                    />
                    <label htmlFor="excelFileInputDirect" className="cursor-pointer space-y-2 block">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-[var(--text-main)] block">Click to select or drag Excel / CSV file here</span>
                        <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">Columns: Item Name, Quantity, Unit, Cost per Unit</span>
                      </div>
                    </label>
                  </div>

                  {parsingCsv && (
                    <div className="text-center py-3 text-xs font-bold text-emerald-400 animate-pulse">
                      Reading Excel file and auto-matching catalog items...
                    </div>
                  )}
                </div>
              )}

              {/* Section 2: Supplier & Receiving Details Card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-400" />
                  Receiving Details
                </h3>

                {/* AI Detected Supplier Suggestion Banner */}
                {aiDetectedSupplier && !supplierId && (
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>
                        AI detected supplier on invoice: <strong className="text-purple-400">{aiDetectedSupplier}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">Select matching supplier below or leave as Local Market.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  
                  {/* Internal Receiving Reference (Dynamic DB Sequence) */}
                  <div>
                    <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1.5 tracking-wider text-[10px] flex justify-between">
                      <span>Internal Reference *</span>
                      <span className="text-[10px] text-orange-400 font-normal lowercase">Auto-generated</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={receivingRef}
                        className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-orange-400 cursor-not-allowed opacity-90"
                      />
                      <button
                        type="button"
                        onClick={generateAutoRef}
                        title="Refresh internal reference counter"
                        className="absolute right-2 top-2 p-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-[10px] font-bold"
                      >
                        🔄
                      </button>
                    </div>
                  </div>

                  {/* Supplier Dropdown */}
                  <div>
                    <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1.5 tracking-wider text-[10px] flex justify-between">
                      <span>Supplier</span>
                      {aiDetectedSupplier && <span className="text-[10px] text-purple-400 font-normal">✨ AI Detected</span>}
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="">-- Local Market / Sabzi Mandi (Not Provided) --</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier Invoice # */}
                  <div>
                    <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1.5 tracking-wider text-[10px] flex justify-between">
                      <span>Supplier Invoice #</span>
                      {aiDetectedInvoiceNumber && <span className="text-[10px] text-purple-400 font-normal">✨ AI Detected</span>}
                    </label>
                    <input
                      type="text"
                      value={supplierInvoiceNumber}
                      onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                      placeholder="Not Provided (e.g. INV-45892)"
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Branch */}
                  <div>
                    <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1.5 tracking-wider text-[10px]">
                      Branch
                    </label>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="1">Main Campus Canteen Branch</option>
                      <option value="2">Block B Extension Branch</option>
                    </select>
                  </div>

                  {/* Receiving Date */}
                  <div>
                    <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1.5 tracking-wider text-[10px]">
                      Receiving Date
                    </label>
                    <input
                      type="date"
                      value={receivingDate}
                      onChange={(e) => setReceivingDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* AI Invoice Total Verification Box */}
              {aiDetectedInvoiceTotal !== null && (
                <div className="bg-[var(--card-bg)] border border-purple-500/30 p-4 rounded-3xl space-y-1 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Invoice Total Check (AI Extracted):
                    </span>
                    {Math.abs(aiDetectedInvoiceTotal - calculatedGrandTotal) < 1 ? (
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Invoice Total Matches ✓ (Rs. {calculatedGrandTotal.toLocaleString()})
                      </span>
                    ) : (
                      <span className="text-amber-400 font-extrabold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Total Difference Found: Invoice Rs. {aiDetectedInvoiceTotal.toLocaleString()} vs Items Subtotal Rs. {calculatedGrandTotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3: Unified Review Stock Items Cards */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                      <Package className="w-4 h-4 text-orange-400" />
                      Review Stock ({receivingRows.length} Items)
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Check and correct any extracted quantities, costs, batch # or expiry dates before confirming.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3.5 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-extrabold transition-all cursor-pointer flex items-center space-x-1.5 border border-orange-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* List of Stacked Item Cards */}
                <div className="space-y-4">
                  {receivingRows.map((row, index) => {
                    const selectedInvItem = inventory.find(i => String(i.id) === String(row.inventoryItemId));
                    const lineSubtotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0);
                    const costDifference = selectedInvItem && row.unitCost > 0 && selectedInvItem.costPrice !== row.unitCost;

                    return (
                      <div
                        key={index}
                        className={`p-4 sm:p-5 rounded-2xl bg-[var(--bg-color)]/60 border space-y-4 relative transition-all ${
                          row.isUnmatched
                            ? 'border-amber-500/60 bg-amber-500/5'
                            : row.isAiDetected
                            ? 'border-purple-500/40 bg-purple-500/5'
                            : 'border-[var(--border-color)] hover:border-orange-500/30'
                        }`}
                      >
                        {/* Card Top: Number, Item Input & Badges */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <span className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-400 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>

                            {/* Searchable Autocomplete Item Input */}
                            <div className="relative flex-1 sm:w-80">
                              <input
                                type="text"
                                value={row.searchTerm}
                                onFocus={() => handleRowChange(index, 'showSearchDropdown', true)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleRowChange(index, 'searchTerm', val);
                                  handleRowChange(index, 'showSearchDropdown', true);

                                  const exactMatch = inventory.find(i => i.name.toLowerCase().trim() === val.toLowerCase().trim());
                                  if (exactMatch) {
                                    handleSelectItem(index, exactMatch);
                                  }
                                }}
                                placeholder="Search or select catalog item..."
                                className="w-full pl-8 pr-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                              />
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />

                              {/* Autocomplete Dropdown List */}
                              {row.showSearchDropdown && (
                                <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-[var(--border-color)]">
                                  {(() => {
                                    const q = (row.searchTerm || '').toLowerCase().trim();
                                    const matches = inventory.filter(i => {
                                      if (!q) return true;
                                      const nameMatch = i.name.toLowerCase().includes(q);
                                      const catMatch = i.category?.toLowerCase().includes(q);
                                      
                                      let aliasMatch = false;
                                      for (const [alias, targets] of Object.entries(ITEM_ALIASES)) {
                                        if (alias.includes(q) && targets.some(t => i.name.toLowerCase().includes(t))) {
                                          aliasMatch = true;
                                          break;
                                        }
                                      }
                                      return nameMatch || catMatch || aliasMatch;
                                    });

                                    if (matches.length === 0) {
                                      return (
                                        <div className="p-3 text-center text-[var(--text-muted)] text-[11px]">
                                          No item matching "<span className="text-[var(--text-main)] font-semibold">{row.searchTerm}</span>".
                                        </div>
                                      );
                                    }

                                    return matches.map((item) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectItem(index, item)}
                                        className="w-full text-left px-3 py-2 hover:bg-orange-500/10 transition-colors flex items-center justify-between cursor-pointer"
                                      >
                                        <div>
                                          <span className="font-bold text-[var(--text-main)]">{item.name}</span>
                                          <span className="ml-2 text-[10px] text-[var(--text-muted)]">({item.category || 'General'})</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[var(--bg-color)] text-orange-400 border border-orange-500/20">
                                          {item.unit || 'KG'}
                                        </span>
                                      </button>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Badges: AI Detected / Needs Matching / Ready */}
                          <div className="flex items-center space-x-2 self-end sm:self-auto">
                            {row.isAiDetected && (
                              <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase tracking-wider border border-purple-500/30 flex items-center gap-1">
                                ✨ AI Detected
                              </span>
                            )}

                            {row.isUnmatched ? (
                              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                                ⚠️ Needs Matching
                              </span>
                            ) : selectedInvItem ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                                ✓ Ready ({selectedInvItem.category || 'General'})
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleRemoveRow(index)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer border border-rose-500/20"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Card Fields: Quantity, Unit, Cost per Unit, Subtotal */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1 border-t border-[var(--border-color)]/60">
                          
                          {/* Quantity & Unit */}
                          <div>
                            <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                              Quantity Received *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={row.quantity}
                                onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                              />
                              <select
                                value={row.unit}
                                onChange={(e) => handleRowChange(index, 'unit', e.target.value)}
                                className="px-2.5 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                              >
                                <option value="KG">KG</option>
                                <option value="G">G</option>
                                <option value="L">L</option>
                                <option value="ML">ML</option>
                                <option value="PCS">PCS</option>
                                <option value="DOZEN">DOZEN</option>
                                <option value="BOX">BOX</option>
                                <option value="PACK">PACK</option>
                                <option value="BOTTLE">BOTTLE</option>
                                <option value="BAG">BAG</option>
                              </select>
                            </div>
                          </div>

                          {/* Cost per Unit */}
                          <div>
                            <label className="block font-extrabold text-[var(--text-main)] uppercase mb-1 tracking-wider text-[10px]">
                              Cost per Unit (Rs.)
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={row.unitCost}
                              onChange={(e) => handleRowChange(index, 'unitCost', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                            />
                            <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">
                              Cost for 1 {row.unit || 'Unit'}
                            </span>
                          </div>

                          {/* Subtotal */}
                          <div className="flex flex-col items-start sm:items-end justify-center bg-[var(--card-bg)]/80 p-2.5 rounded-xl border border-[var(--border-color)]">
                            <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                              Subtotal
                            </span>
                            <span className="text-base font-black text-orange-400 font-mono">
                              Rs. {lineSubtotal.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Cost Changed Alert */}
                        {costDifference && (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-semibold">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Cost changed — Catalog cost: <strong>Rs. {selectedInvItem.costPrice} / {selectedInvItem.unit}</strong> ➔ Received cost: <strong>Rs. {row.unitCost} / {row.unit}</strong>
                            </span>
                          </div>
                        )}

                        {/* Collapsible Details (Batch & Expiry) */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleRowChange(index, 'showMoreDetails', !row.showMoreDetails)}
                            className="text-[10px] font-bold text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {row.showMoreDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>{row.showMoreDetails ? 'Hide Batch & Expiry' : 'More Details (Batch #, Expiry Date — Optional)'}</span>
                          </button>

                          {row.showMoreDetails && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[var(--border-color)]/50">
                              <div>
                                <label className="block font-extrabold text-[var(--text-muted)] uppercase mb-1 text-[9px]">
                                  Batch Number (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={row.batchNumber}
                                  onChange={(e) => handleRowChange(index, 'batchNumber', e.target.value)}
                                  placeholder="Not Provided"
                                  className="w-full px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)]"
                                />
                              </div>

                              <div>
                                <label className="block font-extrabold text-[var(--text-muted)] uppercase mb-1 text-[9px]">
                                  Expiry Date (Optional)
                                </label>
                                <input
                                  type="date"
                                  value={row.expiryDate}
                                  onChange={(e) => handleRowChange(index, 'expiryDate', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-mono text-[var(--text-main)] cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-3 rounded-2xl border-2 border-dashed border-[var(--border-color)] hover:border-orange-500/50 text-[var(--text-muted)] hover:text-orange-400 text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Item</span>
                  </button>
                </div>
              </div>

              {/* Section 4: Notes Card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-5 space-y-2 shadow-sm">
                <label className="block font-black text-[var(--text-main)] uppercase tracking-wider text-[10px]">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Fresh stock received from supplier."
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Section 5: Review Stock Summary & Action Buttons */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider block">
                    Stock Receiving Summary
                  </span>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs font-extrabold text-[var(--text-main)]">
                      Items: <strong className="text-orange-400">{validItemsCount}</strong>
                    </span>
                    <span className="text-xs font-extrabold text-[var(--text-main)]">
                      Total Cost: <strong className="text-emerald-400 font-mono text-sm">Rs. {calculatedGrandTotal.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleInitiateSubmit('DRAFT')}
                    disabled={loading}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInitiateSubmit('RECEIVED')}
                    disabled={loading}
                    className="flex-1 sm:flex-initial px-7 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow-lg shadow-orange-600/20 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Receive Stock</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal — Confirm Stock Receiving? */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-black text-[var(--text-main)] font-display flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-orange-500/10 text-orange-400">📦</span>
                Confirm Stock Receiving
              </h3>
              <button onClick={() => setShowConfirmModal(false)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-[var(--bg-color)]/60 p-4 rounded-2xl border border-[var(--border-color)]">
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-[var(--text-muted)] font-semibold">Receiving Reference:</span>
                <span className="font-mono font-bold text-orange-400">{receivingRef}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-[var(--text-muted)] font-semibold">Supplier:</span>
                <span className="font-bold text-[var(--text-main)]">
                  {suppliers.find(s => String(s.id) === String(supplierId))?.name || 'Local Market / Not Provided'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-[var(--text-muted)] font-semibold">Supplier Invoice #:</span>
                <span className="font-mono font-semibold text-[var(--text-main)]">
                  {supplierInvoiceNumber || 'Not Provided'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[var(--border-color)]/50">
                <span className="text-[var(--text-muted)] font-semibold">Total Items:</span>
                <span className="font-bold text-orange-400">{validItemsCount} items</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[var(--text-muted)] font-semibold">Total Cost:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">Rs. {calculatedGrandTotal.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">
              Receiving this stock will immediately update catalog balances (New Stock = Current + Received) and save stock logs.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] font-bold text-xs text-[var(--text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeSubmitReceiving('RECEIVED')}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs shadow-md cursor-pointer"
              >
                Confirm & Receive Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History SubTab */}
      {subTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="bg-[var(--card-bg)] p-4 rounded-3xl border border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search reference (RCV-...), supplier..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] font-semibold"
              />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                type="button"
                onClick={fetchReceivings}
                className="p-2 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Reference</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Total Cost</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {receivingsList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-[var(--text-muted)] text-xs">
                        No receiving records found.
                      </td>
                    </tr>
                  ) : (
                    receivingsList.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-orange-400">
                          {rec.receivingNumber || rec.invoiceNumber}
                        </td>
                        <td className="p-4 text-[var(--text-muted)] font-medium">
                          {new Date(rec.receivingDate).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-semibold text-[var(--text-main)]">
                          {rec.supplier?.name || 'Local Market / Not Provided'}
                        </td>
                        <td className="p-4 font-bold text-[var(--text-main)]">
                          {rec.items?.length || 0} items
                        </td>
                        <td className="p-4 font-mono font-black text-emerald-400">
                          Rs. {(rec.totalCost || 0).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border ${
                            rec.status === 'RECEIVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : rec.status === 'DRAFT'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiving(rec);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {rec.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmDraft(rec.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px]"
                            >
                              Confirm
                            </button>
                          )}
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

      {/* AI OCR Invoice Modal */}
      {showOcrModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <h3 className="text-base font-black text-[var(--text-main)] flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                Upload Invoice (AI Recognized)
              </h3>
              <button onClick={() => setShowOcrModal(false)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-color)] border-2 border-dashed border-[var(--border-color)] text-center space-y-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleOcrFileSelect(e.target.files[0])}
                className="hidden"
                id="ocrFileInput"
              />
              <label htmlFor="ocrFileInput" className="cursor-pointer space-y-1 block">
                <Camera className="w-8 h-8 text-purple-400 mx-auto" />
                <span className="text-xs font-bold text-[var(--text-main)] block">Upload Invoice Image or PDF</span>
                <span className="text-[10px] text-[var(--text-muted)] block">Groq AI Vision extracts supplier, invoice #, items, batch # & expiry dates into Review Stock.</span>
              </label>
            </div>

            {extractingOcr && (
              <div className="text-center py-4 text-xs font-bold text-purple-400 animate-pulse flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                Analyzing invoice image using AI...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receiving Details Modal */}
      {showDetailsModal && selectedReceiving && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-base font-black text-orange-400 font-mono">
                  {selectedReceiving.receivingNumber || selectedReceiving.invoiceNumber}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Received on {new Date(selectedReceiving.receivingDate).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-[var(--bg-color)] p-3.5 rounded-2xl text-xs font-semibold">
              <div>Supplier: <strong className="text-[var(--text-main)] block mt-0.5">{selectedReceiving.supplier?.name || 'Local Market / Not Provided'}</strong></div>
              <div>Invoice #: <strong className="text-[var(--text-main)] font-mono block mt-0.5">{selectedReceiving.invoiceNumber || 'Not Provided'}</strong></div>
              <div>Status: <strong className="text-orange-400 block mt-0.5">{selectedReceiving.status}</strong></div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-[var(--text-muted)]">Items Received</h4>
              <div className="max-h-60 overflow-y-auto border border-[var(--border-color)] rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-color)] text-[10px] uppercase text-[var(--text-muted)]">
                    <tr>
                      <th className="p-3">Item</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Cost</th>
                      <th className="p-3">Batch / Expiry</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {selectedReceiving.items?.map((i) => (
                      <tr key={i.id}>
                        <td className="p-3 font-bold text-[var(--text-main)]">{i.inventoryItem?.name}</td>
                        <td className="p-3 font-mono">{i.quantity} {i.unit}</td>
                        <td className="p-3 font-mono">Rs. {i.unitCost}</td>
                        <td className="p-3 font-mono text-[10px] text-[var(--text-muted)]">
                          {i.batchNumber || 'No Batch'} | {i.expiryDate ? new Date(i.expiryDate).toLocaleDateString() : 'No Expiry'}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400 text-right">Rs. {i.totalCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setShowDetailsModal(false)} className="px-5 py-2.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminInventoryReceivingView;

import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Search,
  Download,
  Printer,
  History,
  CheckCircle2,
  XCircle,
  X,
  Truck,
  TrendingUp,
  Clock,
  Layers,
  DollarSign,
  PieChart,
  Edit3,
  Calendar,
  Building2,
  Save,
  Trash2,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';
import api from '../../../services/api';

const AdminInventoryView = ({ inventory = [], logs = [], onRefresh, showToast }) => {
  const [activeTab, setActiveTab] = useState('CATALOG');
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // Stock In state
  const [stockInItem, setStockInItem] = useState('');
  const [stockInQty, setStockInQty] = useState('');
  const [stockInCost, setStockInCost] = useState('');
  const [stockInBatch, setStockInBatch] = useState('');
  const [stockInExpiry, setStockInExpiry] = useState('');
  const [stockInSupplier, setStockInSupplier] = useState('');
  const [stockInNotes, setStockInNotes] = useState('');

  // Stock Adjustment / Waste state
  const [adjItem, setAdjItem] = useState('');
  const [adjType, setAdjType] = useState('WASTE');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Modal / Recipe state
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [menuItemsList, setMenuItemsList] = useState([]);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [marginsList, setMarginsList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [expiringList, setExpiringList] = useState([]);
  
  // New Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    unit: 'KG',
    category: 'General',
    minThreshold: '10',
    maxThreshold: '100',
    costPrice: '0',
    stockLevel: '0',
    supplierId: '',
  });

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
  });

  const fetchSummary = async () => {
    try {
      const res = await api.get('/inventory/summary');
      if (res.data) setSummary(res.data);
    } catch (err) {
      console.warn('Fetch summary error:', err.message);
    }
  };

  const fetchMargins = async () => {
    try {
      const res = await api.get('/inventory/recipes/margins');
      if (res.data?.margins) setMarginsList(res.data.margins);
    } catch (err) {
      console.warn('Fetch margins error:', err.message);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/inventory/suppliers');
      if (res.data?.suppliers) setSuppliersList(res.data.suppliers);
    } catch (err) {
      console.warn('Fetch suppliers error:', err.message);
    }
  };

  const fetchExpiring = async () => {
    try {
      const res = await api.get('/inventory/expiring');
      if (res.data?.items) setExpiringList(res.data.items);
    } catch (err) {
      console.warn('Fetch expiring error:', err.message);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await api.get('/menu?all=true');
      if (res.data?.items) setMenuItemsList(res.data.items);
    } catch (err) {
      console.warn('Fetch menu items error:', err.message);
    }
  };

  useEffect(() => {
    fetchSummary();
    if (activeTab === 'MARGINS' || activeTab === 'RECIPES') fetchMargins();
    if (activeTab === 'SUPPLIERS' || activeTab === 'STOCK_IN') fetchSuppliers();
    if (activeTab === 'EXPIRY') fetchExpiring();
    if (activeTab === 'RECIPES') fetchMenuItems();
  }, [activeTab]);

  const stockList = useMemo(() => {
    return inventory.map((item) => {
      let status = 'NORMAL';
      if (item.stockLevel <= 0) status = 'CRITICAL';
      else if (item.stockLevel <= item.minThreshold) status = 'LOW';
      else if (item.stockLevel >= item.minThreshold * 5) status = 'OVERSTOCK';

      return { ...item, status };
    });
  }, [inventory]);

  const filteredStock = useMemo(() => {
    return stockList.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [stockList, searchTerm, statusFilter, categoryFilter]);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory', newItem);
      if (showToast) showToast(`Added inventory item ${newItem.name}!`);
      setShowAddItemModal(false);
      setNewItem({
        name: '',
        unit: 'KG',
        category: 'General',
        minThreshold: '10',
        maxThreshold: '100',
        costPrice: '0',
        stockLevel: '0',
        supplierId: '',
      });
      if (onRefresh) onRefresh();
      fetchSummary();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to add item', 'error');
    }
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    if (!stockInItem || !stockInQty) return;

    try {
      await api.post('/inventory/stock-in', {
        inventoryItemId: stockInItem,
        quantity: parseFloat(stockInQty),
        unitCost: stockInCost ? parseFloat(stockInCost) : undefined,
        batchNumber: stockInBatch || undefined,
        expiryDate: stockInExpiry || undefined,
        supplierId: stockInSupplier || undefined,
        notes: stockInNotes || undefined,
      });

      if (showToast) showToast('Stock In recorded successfully!');
      setStockInItem('');
      setStockInQty('');
      setStockInCost('');
      setStockInBatch('');
      setStockInExpiry('');
      setStockInNotes('');
      if (onRefresh) onRefresh();
      fetchSummary();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Stock In failed', 'error');
    }
  };

  const handleAdjustment = async (e) => {
    e.preventDefault();
    if (!adjItem || !adjQty) return;

    try {
      await api.post('/inventory/adjust', {
        inventoryItemId: adjItem,
        type: adjType,
        changeQty: adjType === 'WASTE' || adjType === 'EXPIRATION' || adjType === 'DAMAGE' ? -Math.abs(parseFloat(adjQty)) : parseFloat(adjQty),
        reason: adjReason || `Stock ${adjType}`,
      });

      if (showToast) showToast(`Stock adjustment (${adjType}) saved!`);
      setAdjItem('');
      setAdjQty('');
      setAdjReason('');
      if (onRefresh) onRefresh();
      fetchSummary();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Adjustment failed', 'error');
    }
  };

  const handleLoadRecipe = async (menuItem) => {
    setSelectedMenuItem(menuItem);
    try {
      const res = await api.get(`/inventory/recipes/${menuItem.id}`);
      if (res.data?.menuItem?.recipeItems) {
        setRecipeIngredients(
          res.data.menuItem.recipeItems.map((r) => ({
            inventoryItemId: r.inventoryItemId,
            quantity: r.quantity,
            unit: r.unit,
          }))
        );
      } else {
        setRecipeIngredients([]);
      }
    } catch (err) {
      console.warn('Fetch recipe details error:', err);
    }
  };

  const handleAddRecipeRow = () => {
    if (inventory.length === 0) return;
    setRecipeIngredients([
      ...recipeIngredients,
      { inventoryItemId: inventory[0].id, quantity: 1, unit: inventory[0].unit || 'G' },
    ]);
  };

  const handleRemoveRecipeRow = (index) => {
    const updated = [...recipeIngredients];
    updated.splice(index, 1);
    setRecipeIngredients(updated);
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!selectedMenuItem) return;

    try {
      await api.post(`/inventory/recipes/${selectedMenuItem.id}`, {
        ingredients: recipeIngredients,
      });

      if (showToast) showToast(`Recipe saved for ${selectedMenuItem.name}!`);
      setSelectedMenuItem(null);
      fetchMargins();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to save recipe', 'error');
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/suppliers', newSupplier);
      if (showToast) showToast(`Supplier ${newSupplier.name} added!`);
      setShowSupplierModal(false);
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      fetchSuppliers();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to add supplier', 'error');
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredStock.map((item) => ({
      ItemName: item.name,
      Category: item.category || 'General',
      CurrentStock: item.stockLevel,
      MinThreshold: item.minThreshold,
      Unit: item.unit,
      CostPrice: item.costPrice || 0,
      Supplier: item.supplier?.name || 'N/A',
      Status: item.status,
    }));

    exportToCSV(`inventory_catalog_${Date.now()}.csv`, csvData, [
      { key: 'ItemName', label: 'Item Name' },
      { key: 'Category', label: 'Category' },
      { key: 'CurrentStock', label: 'Current Stock' },
      { key: 'MinThreshold', label: 'Safety Min' },
      { key: 'Unit', label: 'Unit' },
      { key: 'CostPrice', label: 'Cost Price' },
      { key: 'Supplier', label: 'Supplier' },
      { key: 'Status', label: 'Status' },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-400" />
            <span>Inventory & Supply Chain Hub</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Manage ingredient catalog, stock-in receiving, waste tracking, recipe building, and food cost margins.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingredient</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-1">
          <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Total Catalog Items</span>
          <h4 className="text-2xl font-extrabold text-[var(--text-main)] font-mono">{summary?.totalItems || inventory.length}</h4>
        </div>
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-1">
          <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Low Stock Alerts</span>
          <h4 className="text-2xl font-extrabold text-amber-400 font-mono">{summary?.lowStockCount || 0}</h4>
        </div>
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-1">
          <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Critical Out-of-Stock</span>
          <h4 className="text-2xl font-extrabold text-rose-400 font-mono">{summary?.criticalCount || 0}</h4>
        </div>
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-1">
          <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Inventory Valuation</span>
          <h4 className="text-2xl font-extrabold text-emerald-400 font-mono">Rs. {(summary?.totalValuation || 0).toLocaleString()}</h4>
        </div>
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-1">
          <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Expiring Soon (7d)</span>
          <h4 className="text-2xl font-extrabold text-orange-400 font-mono">{summary?.expiringCount || 0}</h4>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex items-center p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl overflow-x-auto gap-1">
        {[
          { id: 'CATALOG', label: 'Inventory Catalog', icon: Layers },
          { id: 'STOCK_IN', label: 'Stock In (Receiving)', icon: Truck },
          { id: 'ADJUSTMENT', label: 'Waste & Adjustments', icon: AlertTriangle },
          { id: 'RECIPES', label: 'Recipe Builder', icon: Edit3 },
          { id: 'MARGINS', label: 'Food Cost & Margins', icon: DollarSign },
          { id: 'EXPIRY', label: 'Expiry Tracking', icon: Clock },
          { id: 'SUPPLIERS', label: 'Suppliers', icon: Building2 },
          { id: 'LOGS', label: `Logs (${logs.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: CATALOG */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-12 gap-4">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search raw ingredient name..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low Stock</option>
                <option value="CRITICAL">Critical</option>
                <option value="OVERSTOCK">Overstock</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="Meat / Protein">Meat / Protein</option>
                <option value="Vegetables">Vegetables & Produce</option>
                <option value="Dairy">Dairy</option>
                <option value="Bakery">Bakery</option>
                <option value="Dry Goods">Dry Goods</option>
                <option value="Beverages">Beverages</option>
                <option value="Sauces & Condiments">Sauces & Condiments</option>
                <option value="Spices">Spices</option>
                <option value="Cooking Oil">Cooking Oil</option>
                <option value="Packaging">Packaging</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Safety Min</th>
                    <th className="p-4">Unit Cost</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredStock.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                      <td className="p-4 font-bold text-[var(--text-main)]">{item.name}</td>
                      <td className="p-4 text-[var(--text-muted)]">{item.category || 'General'}</td>
                      <td className="p-4 font-mono font-extrabold text-orange-400">
                        {item.stockLevel} {item.unit}
                      </td>
                      <td className="p-4 font-mono text-[var(--text-muted)]">{item.minThreshold} {item.unit}</td>
                      <td className="p-4 font-mono font-semibold text-emerald-400">
                        {item.costPrice > 0 ? `Rs. ${item.costPrice}` : <span className="text-[var(--text-muted)] italic font-sans text-[10px]">Cost not configured</span>}
                      </td>
                      <td className="p-4 text-[var(--text-muted)]">{item.supplier?.name || '—'}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                            item.status === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                              : item.status === 'LOW'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : item.status === 'OVERSTOCK'
                              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK IN (RECEIVING) */}
      {activeTab === 'STOCK_IN' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl max-w-2xl space-y-6">
          <h3 className="text-base font-extrabold text-[var(--text-main)] font-display flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <span>Stock In / Goods Receipt</span>
          </h3>

          <form onSubmit={handleStockIn} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Select Ingredient *</label>
              <select
                required
                value={stockInItem}
                onChange={(e) => setStockInItem(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              >
                <option value="">-- Choose Ingredient --</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (Current: {i.stockLevel} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Quantity Received *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Unit Cost Price (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={stockInCost}
                  onChange={(e) => setStockInCost(e.target.value)}
                  placeholder="e.g. 450"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Batch / Invoice No.</label>
                <input
                  type="text"
                  value={stockInBatch}
                  onChange={(e) => setStockInBatch(e.target.value)}
                  placeholder="e.g. BATCH-2026-09"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={stockInExpiry}
                  onChange={(e) => setStockInExpiry(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Supplier</label>
              <select
                value={stockInSupplier}
                onChange={(e) => setStockInSupplier(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              >
                <option value="">-- Optional Supplier --</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Notes</label>
              <input
                type="text"
                value={stockInNotes}
                onChange={(e) => setStockInNotes(e.target.value)}
                placeholder="Purchase Order notes..."
                className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
            >
              Confirm Stock Receipt
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: WASTE & ADJUSTMENTS */}
      {activeTab === 'ADJUSTMENT' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl max-w-2xl space-y-6">
          <h3 className="text-base font-extrabold text-[var(--text-main)] font-display flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Stock Waste & Manual Adjustment</span>
          </h3>

          <form onSubmit={handleAdjustment} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Select Ingredient *</label>
              <select
                required
                value={adjItem}
                onChange={(e) => setAdjItem(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              >
                <option value="">-- Choose Ingredient --</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} (Current: {i.stockLevel} {i.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Adjustment Type *</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                >
                  <option value="WASTE">Spoilage / Kitchen Waste</option>
                  <option value="EXPIRATION">Expired Product</option>
                  <option value="DAMAGE">Damaged Goods</option>
                  <option value="CORRECTION">Audit Count Correction</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Reason / Explanation *</label>
              <input
                type="text"
                required
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="e.g. Over-prep spoil or fridge failure"
                className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
            >
              Record Adjustment
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: RECIPE BUILDER */}
      {activeTab === 'RECIPES' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-sm font-black text-[var(--text-main)] uppercase">Select Menu Item</h3>
            <div className="divide-y divide-[var(--border-color)] max-h-96 overflow-y-auto">
              {menuItemsList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => handleLoadRecipe(m)}
                  className={`p-3 cursor-pointer hover:bg-[var(--bg-color)]/60 transition-colors flex justify-between items-center rounded-xl ${
                    selectedMenuItem?.id === m.id ? 'bg-orange-600/20 border border-orange-500/30' : ''
                  }`}
                >
                  <div>
                    <strong className="text-xs text-[var(--text-main)] block">{m.name}</strong>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">Rs. {m.price}</span>
                  </div>
                  <span className="text-[10px] bg-[var(--card-bg)] px-2 py-1 rounded font-bold text-orange-400">
                    Edit Recipe
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
            {selectedMenuItem ? (
              <form onSubmit={handleSaveRecipe} className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[var(--text-main)] font-display">Recipe Ingredients</h3>
                    <p className="text-xs text-[var(--text-muted)]">{selectedMenuItem.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRecipeRow}
                    className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {recipeIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[var(--bg-color)] p-2.5 rounded-xl border border-[var(--border-color)]">
                      <select
                        value={ing.inventoryItemId}
                        onChange={(e) => {
                          const updated = [...recipeIngredients];
                          updated[idx].inventoryItemId = parseInt(e.target.value, 10);
                          const matched = inventory.find((i) => i.id === updated[idx].inventoryItemId);
                          if (matched) updated[idx].unit = matched.unit;
                          setRecipeIngredients(updated);
                        }}
                        className="flex-1 bg-transparent text-xs text-[var(--text-main)] focus:outline-none"
                      >
                        {inventory.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} ({inv.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={ing.quantity}
                        onChange={(e) => {
                          const updated = [...recipeIngredients];
                          updated[idx].quantity = parseFloat(e.target.value);
                          setRecipeIngredients(updated);
                        }}
                        placeholder="Qty"
                        className="w-20 px-2 py-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded text-xs text-right font-mono"
                      />

                      <select
                        value={ing.unit}
                        onChange={(e) => {
                          const updated = [...recipeIngredients];
                          updated[idx].unit = e.target.value;
                          setRecipeIngredients(updated);
                        }}
                        className="w-20 bg-[var(--card-bg)] border border-[var(--border-color)] rounded px-1 py-1 text-xs"
                      >
                        <option value="G">G</option>
                        <option value="KG">KG</option>
                        <option value="ML">ML</option>
                        <option value="L">L</option>
                        <option value="PCS">PCS</option>
                        <option value="DOZEN">DOZEN</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Recipe</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center text-[var(--text-muted)] italic">
                Select a menu item on the left to edit its recipe ingredients.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MARGINS */}
      {activeTab === 'MARGINS' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Dish Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Selling Price</th>
                  <th className="p-4">Est. Food Cost</th>
                  <th className="p-4">Gross Profit</th>
                  <th className="p-4">Margin %</th>
                  <th className="p-4">Recipe Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {marginsList.map((m) => {
                  const profit = m.price - m.foodCost;
                  return (
                    <tr key={m.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                      <td className="p-4 font-bold text-[var(--text-main)]">{m.name}</td>
                      <td className="p-4 text-[var(--text-muted)]">{m.category}</td>
                      <td className="p-4 font-mono font-bold text-[var(--text-main)]">Rs. {m.price}</td>
                      <td className="p-4 font-mono text-rose-400">Rs. {m.foodCost.toFixed(2)}</td>
                      <td className="p-4 font-mono font-bold text-emerald-400">Rs. {profit.toFixed(2)}</td>
                      <td className="p-4 font-mono font-extrabold">
                        <span
                          className={`px-2 py-1 rounded text-[10px] ${
                            m.grossMarginPercent >= 60
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : m.grossMarginPercent >= 40
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {m.grossMarginPercent}%
                        </span>
                      </td>
                      <td className="p-4">
                        {m.hasRecipe ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {m.recipeCount} items
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">No recipe</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: EXPIRY */}
      {activeTab === 'EXPIRY' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Ingredient</th>
                  <th className="p-4">Stock Level</th>
                  <th className="p-4">Expiry Date</th>
                  <th className="p-4">Days Remaining</th>
                  <th className="p-4">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {expiringList.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                    <td className="p-4 font-bold text-[var(--text-main)]">{item.name}</td>
                    <td className="p-4 font-mono font-bold text-orange-400">{item.stockLevel} {item.unit}</td>
                    <td className="p-4 text-[var(--text-muted)]">{new Date(item.expiryDate).toLocaleDateString()}</td>
                    <td className="p-4 font-bold">
                      <span
                        className={`px-2 py-1 rounded text-[10px] ${
                          item.daysUntilExpiry <= 3
                            ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                            : item.daysUntilExpiry <= 7
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {item.daysUntilExpiry <= 0 ? 'EXPIRED' : `${item.daysUntilExpiry} days`}
                      </span>
                    </td>
                    <td className="p-4 text-[var(--text-muted)]">{item.supplier?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: SUPPLIERS */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-extrabold text-[var(--text-main)] font-display">Supplier Directory</h3>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="px-3.5 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {suppliersList.map((s) => (
              <div key={s.id} className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl shadow-md space-y-2">
                <h4 className="font-extrabold text-sm text-[var(--text-main)]">{s.name}</h4>
                <p className="text-xs text-[var(--text-muted)]">Contact: {s.contactPerson || 'N/A'}</p>
                <p className="text-xs text-[var(--text-muted)]">Phone: {s.phone || 'N/A'}</p>
                <p className="text-xs text-[var(--text-muted)]">Email: {s.email || 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: LOGS */}
      {activeTab === 'LOGS' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Item</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Before Qty</th>
                  <th className="p-4">Change</th>
                  <th className="p-4">After Qty</th>
                  <th className="p-4">Reason / Source</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                    <td className="p-4 font-bold text-[var(--text-main)]">{log.inventoryItem?.name || `Item #${log.inventoryItemId}`}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-[var(--bg-color)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        {log.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[var(--text-muted)]">{log.quantityBefore}</td>
                    <td className="p-4 font-mono font-extrabold">
                      <span className={log.changeQty > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-extrabold text-orange-400">{log.quantityAfter}</td>
                    <td className="p-4 text-[var(--text-main)] font-semibold">{log.reason || 'Log entry'}</td>
                    <td className="p-4 text-[11px] text-[var(--text-muted)]">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add New Ingredient Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <h3 className="text-base font-extrabold text-[var(--text-main)]">Add New Ingredient Item</h3>
              <button onClick={() => setShowAddItemModal(false)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Ingredient Name *</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Basmati Rice"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Unit *</label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                  >
                    <option value="KG">KG</option>
                    <option value="G">G</option>
                    <option value="L">L</option>
                    <option value="ML">ML</option>
                    <option value="PCS">PCS</option>
                    <option value="DOZEN">DOZEN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Safety Min Threshold</label>
                  <input
                    type="number"
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({ ...newItem, minThreshold: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.costPrice}
                    onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-color)] font-bold text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold shadow-md"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <h3 className="text-base font-extrabold text-[var(--text-main)]">Add Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="p-1.5 rounded-xl bg-[var(--bg-color)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="e.g. Metro Wholesale Pakistan"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Contact Person</label>
                <input
                  type="text"
                  value={newSupplier.contactPerson}
                  onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                  placeholder="e.g. Ali Ahmed"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Phone</label>
                  <input
                    type="text"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    placeholder="0300-1234567"
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    placeholder="supplier@metro.pk"
                    className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-color)] font-bold text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold shadow-md"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryView;

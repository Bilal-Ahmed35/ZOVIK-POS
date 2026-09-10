import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';
import api from '../../../services/api';

const AdminInventoryView = ({ inventory = [], logs = [], onRefresh, showToast }) => {
  const [activeTab, setActiveTab] = useState('STOCK');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedItem, setSelectedItem] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockReason, setRestockReason] = useState('Manual Restock');

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
      return matchesSearch && matchesStatus;
    });
  }, [stockList, searchTerm, statusFilter]);

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!selectedItem || !restockQty) return;

    try {
      await api.post(`/inventory/${selectedItem.id}/restock`, {
        quantity: parseInt(restockQty, 10),
        reason: restockReason,
      });

      if (showToast) showToast(`Restocked ${restockQty} ${selectedItem.unit} of ${selectedItem.name}!`);
      setSelectedItem(null);
      setRestockQty('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Restock failed', 'error');
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredStock.map((item) => ({
      ItemName: item.name,
      CurrentStock: item.stockLevel,
      MinThreshold: item.minThreshold,
      Unit: item.unit,
      Status: item.status,
      LastUpdated: new Date(item.updatedAt).toLocaleString(),
    }));

    exportToCSV(`inventory_stock_${Date.now()}.csv`, csvData, [
      { key: 'ItemName', label: 'Item Name' },
      { key: 'CurrentStock', label: 'Current Stock' },
      { key: 'MinThreshold', label: 'Safety Minimum' },
      { key: 'Unit', label: 'Unit' },
      { key: 'Status', label: 'Stock Status' },
      { key: 'LastUpdated', label: 'Last Updated' },
    ]);
  };

  const handleExportPDF = () => {
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Current Stock</th>
            <th>Safety Minimum</th>
            <th>Unit</th>
            <th>Status</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          ${filteredStock
            .map(
              (i) => `
            <tr>
              <td><strong>${i.name}</strong></td>
              <td>${i.stockLevel}</td>
              <td>${i.minThreshold}</td>
              <td>${i.unit}</td>
              <td><span class="badge ${i.status === 'CRITICAL' ? 'badge-danger' : i.status === 'LOW' ? 'badge-warning' : 'badge-success'}">${i.status}</span></td>
              <td>${new Date(i.updatedAt).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    printPDFReport('Inventory Stock Audit Report', tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">Inventory & Stock Logs</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Audit raw ingredient stock levels, restock safety reserves, and track log movement.</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl w-fit gap-1">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'STOCK' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Stock Inventory Catalog
        </button>
        <button
          onClick={() => setActiveTab('LOGS')}
          className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'LOGS' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          Stock Adjustment Logs ({logs.length})
        </button>
      </div>

      {activeTab === 'STOCK' && (
        <div className="space-y-4">
          {/* Sub Search & Status Filter */}
          <div className="grid sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search inventory item name..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Stock Statuses</option>
                <option value="NORMAL">Normal Stock</option>
                <option value="LOW">Low Stock</option>
                <option value="CRITICAL">Critical Stock</option>
                <option value="OVERSTOCK">Overstock</option>
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Safety Minimum</th>
                    <th className="p-4">Unit</th>
                    <th className="p-4">Status Level</th>
                    <th className="p-4">Last Updated</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredStock.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                      <td className="p-4 font-bold text-[var(--text-main)]">{item.name}</td>
                      <td className="p-4 font-mono font-extrabold text-indigo-400">{item.stockLevel}</td>
                      <td className="p-4 font-mono text-[var(--text-muted)]">{item.minThreshold}</td>
                      <td className="p-4 uppercase font-bold text-[var(--text-muted)]">{item.unit}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                            item.status === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                              : item.status === 'LOW'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : item.status === 'OVERSTOCK'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-[11px] text-[var(--text-muted)]">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all flex items-center space-x-1 ml-auto cursor-pointer shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Restock Item</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Item</th>
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
                    <td className="p-4 font-mono text-[var(--text-muted)]">{log.quantityBefore}</td>
                    <td className="p-4 font-mono font-extrabold">
                      <span className={log.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-extrabold text-indigo-400">{log.quantityAfter}</td>
                    <td className="p-4 text-[var(--text-main)] font-semibold">{log.reason || 'Deduction / Restock'}</td>
                    <td className="p-4 text-[11px] text-[var(--text-muted)]">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-main)] font-display">Restock Ingredient Reserve</h3>
                <p className="text-xs text-[var(--text-muted)]">{selectedItem.name}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4 text-xs">
              <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)] flex justify-between">
                <span>Current Stock: <strong className="text-indigo-400 font-mono">{selectedItem.stockLevel} {selectedItem.unit}</strong></span>
                <span>Minimum: <strong className="text-[var(--text-muted)] font-mono">{selectedItem.minThreshold} {selectedItem.unit}</strong></span>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Restock Quantity ({selectedItem.unit}) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md cursor-pointer"
                >
                  Confirm Restock
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

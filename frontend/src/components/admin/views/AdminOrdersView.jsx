import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  User,
  ShoppingBag,
  CreditCard,
  X,
  FileText,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';

const statusBadges = {
  PENDING: { label: 'PENDING', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  PAYMENT_PENDING: { label: 'PAYMENT PENDING', bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  PAID: { label: 'PAID / VERIFIED', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  PREPARING: { label: 'PREPARING IN KITCHEN', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  READY: { label: 'READY FOR PICKUP', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  COMPLETED: { label: 'COMPLETED', bg: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  CANCELLED: { label: 'CANCELLED', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  PAYMENT_FAILED: { label: 'PAYMENT FAILED', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
  REFUNDED: { label: 'REFUNDED', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const lifecycleSteps = ['PENDING', 'PAYMENT_PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED'];

const AdminOrdersView = ({ orders = [], loading, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesTab = activeTab === 'ALL' || order.status === activeTab;
      const matchesSearch =
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.tableId).includes(searchTerm);
      const matchesMethod = paymentMethodFilter === 'ALL' || order.paymentMethod === paymentMethodFilter;

      return matchesTab && matchesSearch && matchesMethod;
    });
  }, [orders, activeTab, searchTerm, paymentMethodFilter]);

  const handleExportCSV = () => {
    const csvData = filteredOrders.map((o) => ({
      OrderNumber: o.orderNumber,
      Customer: o.user?.name || o.user?.email || 'Guest',
      Email: o.user?.email || 'N/A',
      TableNumber: o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway'),
      TotalAmount: o.total,
      PaymentMethod: o.paymentMethod,
      PaymentStatus: o.paymentStatus,
      OrderStatus: o.status,
      CreatedAt: new Date(o.createdAt).toLocaleString(),
    }));

    exportToCSV(`orders_export_${Date.now()}.csv`, csvData, [
      { key: 'OrderNumber', label: 'Order Number' },
      { key: 'Customer', label: 'Customer' },
      { key: 'Email', label: 'Email' },
      { key: 'TableNumber', label: 'Table' },
      { key: 'TotalAmount', label: 'Total (Rs.)' },
      { key: 'PaymentMethod', label: 'Method' },
      { key: 'PaymentStatus', label: 'Payment Status' },
      { key: 'OrderStatus', label: 'Order Status' },
      { key: 'CreatedAt', label: 'Date Time' },
    ]);
  };

  const handleExportPDF = () => {
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Table</th>
            <th>Total (Rs.)</th>
            <th>Method</th>
            <th>Order Status</th>
            <th>Date Time</th>
          </tr>
        </thead>
        <tbody>
          ${filteredOrders
            .map(
              (o) => `
            <tr>
              <td><strong>${o.orderNumber}</strong></td>
              <td>${o.user?.name || o.user?.email || 'Guest'}</td>
              <td>${o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway')}</td>
              <td>Rs. ${o.total.toFixed(2)}</td>
              <td>${o.paymentMethod}</td>
              <td><span class="badge badge-success">${o.status}</span></td>
              <td>${new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    printPDFReport('Orders & Transactions Report', tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">Orders Management</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Filter, inspect, and export complete dining order lifecycles.</p>
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
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center overflow-x-auto p-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl gap-1 custom-scrollbar">
        {[
          'ALL',
          'PENDING',
          'PAYMENT_PENDING',
          'PAID',
          'PREPARING',
          'READY',
          'COMPLETED',
          'CANCELLED',
          'REFUNDED',
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-color)]'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Search & Sub-Filter Bar */}
      <div className="grid sm:grid-cols-12 gap-4">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order #, Customer Email, Name, or Table..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="COD">Pay at Counter (COD)</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="CARD">Credit / Debit Card</option>
          </select>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)] animate-pulse">
            Loading Orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)]">
            No orders found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Order #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Table</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Order Status</th>
                  <th className="p-4">Date Time</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-xs">
                {filteredOrders.map((order) => {
                  const badge = statusBadges[order.status] || { label: order.status, bg: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

                  return (
                    <tr key={order.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                      <td className="p-4 font-mono font-extrabold text-orange-400">
                        {order.orderNumber}
                      </td>
                      <td className="p-4">
                        <span className="font-bold block text-[var(--text-main)]">{order.user?.name || 'Guest Customer'}</span>
                        <span className="text-[10px] text-[var(--text-muted)] block">{order.user?.email || 'N/A'}</span>
                      </td>
                      <td className="p-4 font-bold text-[var(--text-main)]">
                        {order.tableNumber || (order.tableId ? `Table ${order.tableId}` : 'Takeaway')}
                      </td>
                      <td className="p-4 font-mono font-extrabold text-emerald-400">
                        Rs. {order.total?.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-main)]">
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--text-muted)] text-[11px]">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-xl font-bold transition-all flex items-center space-x-1 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[var(--border-color)] pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Detailed Lifecycle Inspection
                </span>
                <h3 className="text-xl font-extrabold text-[var(--text-main)] mt-1 font-mono">{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-[var(--text-muted)]">Placed at {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Lifecycle Stepper */}
            <div className="p-4 bg-[var(--bg-color)]/60 rounded-2xl border border-[var(--border-color)] space-y-2">
              <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Order Lifecycle Stepper</span>
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
                {lifecycleSteps.map((step, idx) => {
                  const currentIdx = lifecycleSteps.indexOf(selectedOrder.status);
                  const isPassed = currentIdx >= idx;
                  const isCurrent = selectedOrder.status === step;

                  return (
                    <div key={step} className="flex-1 text-center min-w-[70px]">
                      <div
                        className={`h-2 rounded-full mb-1.5 transition-all ${
                          isCurrent
                            ? 'bg-orange-500 shadow-md shadow-orange-500/50'
                            : isPassed
                            ? 'bg-emerald-500'
                            : 'bg-[var(--border-color)]'
                        }`}
                      />
                      <span className={`text-[9px] font-bold block ${isCurrent ? 'text-orange-400' : isPassed ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                        {step.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Customer & Dining Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Customer</span>
                <strong className="text-[var(--text-main)] block font-extrabold">{selectedOrder.user?.name || 'Guest Customer'}</strong>
                <span className="text-[10px] text-[var(--text-muted)]">{selectedOrder.user?.email || 'N/A'}</span>
              </div>
              <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold block uppercase">Table & Session</span>
                <strong className="text-[var(--text-main)] block font-extrabold">{selectedOrder.tableNumber || (selectedOrder.tableId ? `Table #${selectedOrder.tableId}` : 'Takeaway')}</strong>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">Session ID: {selectedOrder.sessionId}</span>
              </div>
            </div>

            {/* Order Items Table Snapshot */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">Item Price Snapshots</span>
              <div className="divide-y divide-[var(--border-color)] bg-[var(--bg-color)]/40 rounded-xl border border-[var(--border-color)]">
                {selectedOrder.orderItems?.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-[var(--text-main)] block font-bold">{item.nameSnapshot || item.menuItem?.name}</strong>
                      <span className="text-[10px] text-[var(--text-muted)]">Qty: {item.quantity} × Rs. {item.priceSnapshot?.toFixed(2)}</span>
                    </div>
                    <span className="font-mono font-extrabold text-orange-400">Rs. {(item.quantity * item.priceSnapshot).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="p-4 bg-[var(--bg-color)] rounded-2xl border border-[var(--border-color)] space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Subtotal:</span>
                <span className="font-mono font-bold">Rs. {selectedOrder.total?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Taxes & Service:</span>
                <span className="font-mono font-bold">Rs. 0.00</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[var(--text-main)] pt-2 border-t border-[var(--border-color)]">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400">Rs. {selectedOrder.total?.toFixed(2)}</span>
              </div>
            </div>

            {/* Transaction / Payment Details */}
            <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)] text-xs space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Payment Info</span>
              <div className="flex justify-between">
                <span>Method: <strong>{selectedOrder.paymentMethod}</strong></span>
                <span>TxID: <strong className="font-mono text-orange-400">{selectedOrder.payment?.transactionId || 'N/A'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersView;

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Download,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';
import api from '../../../services/api';

const AdminPaymentsView = ({ orders = [], onRefresh, showToast }) => {
  const [methodTab, setMethodTab] = useState('ALL');
  const [statusTab, setStatusTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const payments = useMemo(() => {
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.user?.name || 'Guest Customer',
      customerEmail: o.user?.email || 'N/A',
      tableId: o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway'),
      tableNumber: o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway'),
      amount: o.total,
      method: o.paymentMethod,
      orderStatus: o.status,
      paymentStatus: o.paymentStatus || (o.status === 'PAID' ? 'VERIFIED' : 'PENDING'),
      transactionId: o.payment?.transactionId || 'N/A',
      proofImage: o.payment?.proofImage,
      paymentId: o.payment?.id,
      createdAt: o.createdAt,
    }));
  }, [orders]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      let matchesMethod = true;
      if (methodTab === 'COD') matchesMethod = p.method === 'COD';
      else if (methodTab === 'ONLINE') matchesMethod = p.method !== 'COD';

      let matchesStatus = true;
      if (statusTab === 'PENDING') matchesStatus = p.orderStatus === 'PAYMENT_PENDING' || p.paymentStatus === 'PENDING';
      else if (statusTab === 'PAID') matchesStatus = ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(p.orderStatus);
      else if (statusTab === 'FAILED') matchesStatus = p.orderStatus === 'PAYMENT_FAILED';

      const matchesSearch =
        p.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.tableId).includes(searchTerm);

      return matchesMethod && matchesStatus && matchesSearch;
    });
  }, [payments, methodTab, statusTab, searchTerm]);

  const handleVerifyPayment = async (paymentId, status) => {
    if (!paymentId) return;
    setActionLoading(true);
    try {
      await api.put(`/payments/${paymentId}/verify`, { status });
      if (showToast) showToast(`Payment marked as ${status}!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to update payment status', 'error');
    } fontFinally: {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredPayments.map((p) => ({
      OrderNumber: p.orderNumber,
      Customer: p.customerName,
      Email: p.customerEmail,
      Table: p.tableId,
      Amount: p.amount,
      Method: p.method,
      PaymentStatus: p.paymentStatus,
      TransactionID: p.transactionId,
      Date: new Date(p.createdAt).toLocaleString(),
    }));

    exportToCSV(`payments_report_${Date.now()}.csv`, csvData, [
      { key: 'OrderNumber', label: 'Order Number' },
      { key: 'Customer', label: 'Customer' },
      { key: 'Email', label: 'Email' },
      { key: 'Table', label: 'Table' },
      { key: 'Amount', label: 'Amount (Rs.)' },
      { key: 'Method', label: 'Method' },
      { key: 'PaymentStatus', label: 'Payment Status' },
      { key: 'TransactionID', label: 'Transaction ID' },
      { key: 'Date', label: 'Timestamp' },
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
            <th>Amount (Rs.)</th>
            <th>Method</th>
            <th>Transaction ID</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${filteredPayments
            .map(
              (p) => `
            <tr>
              <td><strong>${p.orderNumber}</strong></td>
              <td>${p.customerName}</td>
              <td>${p.tableId}</td>
              <td>Rs. ${p.amount.toFixed(2)}</td>
              <td>${p.method}</td>
              <td>${p.transactionId}</td>
              <td><span class="badge badge-success">${p.paymentStatus}</span></td>
              <td>${new Date(p.createdAt).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    printPDFReport('Payments Audit Report', tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">Payments Monitoring & Audit</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Audit COD cash collections and verify online wallet transactions.</p>
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

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Method Tabs */}
        <div className="flex items-center p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl gap-1">
          {[
            { id: 'ALL', label: 'All Payments' },
            { id: 'COD', label: 'Pay at Counter (COD)' },
            { id: 'ONLINE', label: 'Online Payment' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMethodTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                methodTab === item.id ? 'bg-orange-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Order #, Email, TxID..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Payment Records Table */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)]">
            No payment records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Order #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Table</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">TxID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-xs">
                {filteredPayments.map((p) => {
                  const isPaid = ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(p.orderStatus);
                  const isPending = p.orderStatus === 'PAYMENT_PENDING' || p.paymentStatus === 'PENDING';

                  return (
                    <tr key={p.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                      <td className="p-4 font-mono font-extrabold text-orange-400">{p.orderNumber}</td>
                      <td className="p-4">
                        <span className="font-bold block text-[var(--text-main)]">{p.customerName}</span>
                        <span className="text-[10px] text-[var(--text-muted)] block">{p.customerEmail}</span>
                      </td>
                      <td className="p-4 font-bold">{p.tableId}</td>
                      <td className="p-4 font-mono font-extrabold text-emerald-400">Rs. {p.amount.toFixed(2)}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-[var(--bg-color)] border border-[var(--border-color)] uppercase">
                          {p.method}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px] text-[var(--text-muted)]">{p.transactionId}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {isPaid ? 'PAID / VERIFIED' : isPending ? 'PENDING VERIFICATION' : 'FAILED'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {isPending && p.paymentId ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleVerifyPayment(p.paymentId, 'VERIFIED')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] transition-all cursor-pointer shadow-sm"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerifyPayment(p.paymentId, 'REJECTED')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-bold text-[10px] transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic">Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentsView;

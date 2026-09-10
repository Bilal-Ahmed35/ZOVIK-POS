import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Clock,
  User,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import api from '../../../services/api';

const AdminOrderStatusHistoryView = ({ showToast }) => {
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/order-history');
      setHistoryList(res.data.history || []);
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to load order status history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = historyList.filter(
    (h) =>
      h.order?.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.fromStatus?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.toStatus?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.changedByUser?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-400" />
          <span>Order Status Transition History Timeline</span>
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Auditable timeline showing exact status changes, user accounts, roles, and timestamps per order.</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Order #, Status, or User..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* History Table */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)] animate-pulse">
            Loading Status Transition Timeline...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)]">
            No status transition logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">Order #</th>
                  <th className="p-4">Previous Status</th>
                  <th className="p-4">Transition</th>
                  <th className="p-4">New Status</th>
                  <th className="p-4">Changed By User</th>
                  <th className="p-4">User Role</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                    <td className="p-4 font-mono font-extrabold text-indigo-400">{h.order?.orderNumber || `Order #${h.orderId}`}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-color)] border border-[var(--border-color)]">
                        {h.fromStatus || 'INITIAL'}
                      </span>
                    </td>
                    <td className="p-4 text-indigo-400">
                      <ArrowRight className="w-4 h-4" />
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {h.toStatus}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-[var(--text-main)]">{h.changedByUser?.name || h.changedByUser?.email || 'System'}</td>
                    <td className="p-4 uppercase font-bold text-indigo-400 text-[10px]">{h.changedByUser?.role || 'SYSTEM'}</td>
                    <td className="p-4 text-[11px] text-[var(--text-muted)]">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrderStatusHistoryView;

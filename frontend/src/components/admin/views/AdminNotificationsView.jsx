import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  Package,
  CreditCard,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const AdminNotificationsView = ({ stats, orders = [], onNavigate }) => {
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const notifications = useMemo(() => {
    const list = [];

    // 1. Stock Alerts
    stats?.lowStockAlerts?.forEach((item) => {
      list.push({
        id: `stock-${item.id}`,
        type: 'STOCK',
        title: `${item.statusLevel}: ${item.name}`,
        description: `Current stock level is ${item.stockLevel} ${item.unit} (Safety min: ${item.minThreshold}).`,
        severity: item.stockLevel <= 0 ? 'CRITICAL' : 'WARNING',
        timestamp: new Date(item.updatedAt).toLocaleString(),
        targetTab: 'inventory',
      });
    });

    // 2. Pending Payment Verifications
    orders.forEach((o) => {
      if (o.status === 'PAYMENT_PENDING') {
        list.push({
          id: `payment-${o.id}`,
          type: 'PAYMENT',
          title: `Pending Online Verification: ${o.orderNumber}`,
          description: `Customer submitted transaction ${o.payment?.transactionId || 'N/A'} for Rs. ${o.total.toFixed(2)}.`,
          severity: 'HIGH',
          timestamp: new Date(o.createdAt).toLocaleString(),
          targetTab: 'payments',
        });
      }
    });

    return list;
  }, [stats, orders]);

  const activeNotifications = notifications.filter((n) => !resolvedIds.has(n.id));

  const handleResolve = (id) => {
    setResolvedIds((prev) => new Set([...prev, id]));
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex justify-between items-center bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display flex items-center space-x-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <span>System Notifications & Action Center</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Urgent operations alerts requiring administrator attention.</p>
        </div>

        <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-black uppercase tracking-wider">
          {activeNotifications.length} Action Items
        </span>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {activeNotifications.map((n) => (
          <div
            key={n.id}
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-lg ${
              n.severity === 'CRITICAL'
                ? 'bg-rose-500/10 border-rose-500/30'
                : n.severity === 'HIGH'
                ? 'bg-indigo-500/10 border-indigo-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-indigo-400 shrink-0">
                {n.type === 'STOCK' ? <Package className="w-5 h-5 text-amber-400" /> : <CreditCard className="w-5 h-5 text-indigo-400" />}
              </div>
              <div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  n.severity === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {n.severity}
                </span>
                <h3 className="text-sm font-extrabold text-[var(--text-main)] mt-1">{n.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.description}</p>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{n.timestamp}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => onNavigate(n.targetTab)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                Inspect →
              </button>
              <button
                onClick={() => handleResolve(n.id)}
                className="px-3.5 py-1.5 bg-[var(--bg-color)] hover:bg-[var(--border-color)] text-[var(--text-muted)] font-bold text-xs rounded-xl border border-[var(--border-color)] transition-all cursor-pointer"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        ))}

        {activeNotifications.length === 0 && (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)] bg-[var(--card-bg)]/40 rounded-2xl border border-[var(--border-color)]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <span>All system notifications resolved. No action required!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationsView;

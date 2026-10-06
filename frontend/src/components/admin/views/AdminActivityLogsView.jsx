import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  History,
  Search,
  SlidersHorizontal,
  Truck,
  AlertTriangle,
  FileText,
  Utensils,
  User,
  Clock,
  ChevronRight,
  X,
  CheckCircle2,
  Package
} from 'lucide-react';

const AdminActivityLogsView = ({ logs = [], receivings = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [selectedLogDetails, setSelectedLogDetails] = useState(null);

  // Normalize logs & receivings into human-readable activity stream
  const activities = useMemo(() => {
    const list = [];

    // 1. Process Inventory Logs
    logs.forEach(log => {
      const createdAt = new Date(log.createdAt || Date.now());
      const type = (log.type || 'ADJUST').toUpperCase();
      const userName = log.user?.name || log.userName || 'Staff Member';
      const itemName = log.inventoryItem?.name || log.itemName || 'Inventory Item';
      const changeQty = log.changeQty || 0;
      const unit = log.inventoryItem?.unit || log.unit || 'PCS';
      const reason = log.reason || '';

      let actionLabel = 'Stock Adjusted';
      let icon = AlertTriangle;
      let badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

      if (type === 'RESTOCK' || type === 'RECEIVING' || reason.toLowerCase().includes('received')) {
        actionLabel = 'Stock Received';
        icon = Truck;
        badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      } else if (type === 'USAGE' || reason.toLowerCase().includes('recipe') || reason.toLowerCase().includes('order')) {
        actionLabel = 'Stock Deducted';
        icon = Utensils;
        badgeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      }

      list.push({
        id: `log-${log.id}`,
        timestamp: createdAt,
        dateFormatted: createdAt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
        timeFormatted: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        userName,
        actionLabel,
        type,
        itemName,
        changeQty: changeQty > 0 ? `+${changeQty} ${unit}` : `${changeQty} ${unit}`,
        rawChangeQty: changeQty,
        reference: log.orderId ? `Order #${log.orderId}` : (log.reference || `LOG-${log.id}`),
        reason: reason || `${actionLabel} for ${itemName}`,
        icon,
        badgeColor,
        rawLog: log
      });
    });

    // 2. Process Receivings as Activity Logs if not already in logs
    receivings.forEach(rcv => {
      const createdAt = new Date(rcv.createdAt || Date.now());
      const userName = rcv.receivedBy?.name || rcv.receivedByName || 'Staff Member';

      const exists = list.some(l => l.reference === rcv.receivingRef);
      if (!exists) {
        list.push({
          id: `rcv-act-${rcv.id}`,
          timestamp: createdAt,
          dateFormatted: createdAt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
          timeFormatted: createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userName,
          actionLabel: 'Stock Received',
          type: 'RECEIVING',
          itemName: rcv.supplierName ? `Shipment from ${rcv.supplierName}` : `${rcv.items?.length || 0} Items Received`,
          changeQty: `+${rcv.items?.length || 0} Items`,
          rawChangeQty: 1,
          reference: rcv.receivingRef,
          reason: `Stock shipment received (${rcv.receivingRef})`,
          icon: Truck,
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          rawReceiving: rcv
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, receivings]);

  // Summary Metrics
  const summary = useMemo(() => {
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    let stockChanges = 0;
    let receivingsCount = 0;
    let adjustmentsCount = 0;

    activities.forEach(a => {
      if (a.timestamp.toDateString() === todayStr) todayCount++;
      if (a.type === 'RECEIVING' || a.actionLabel === 'Stock Received') receivingsCount++;
      else if (a.actionLabel === 'Stock Adjusted') adjustmentsCount++;
      else stockChanges++;
    });

    return { todayCount, stockChanges, receivingsCount, adjustmentsCount };
  }, [activities]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return activities.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        a.itemName.toLowerCase().includes(q) ||
        a.userName.toLowerCase().includes(q) ||
        a.reference.toLowerCase().includes(q) ||
        a.actionLabel.toLowerCase().includes(q) ||
        a.reason.toLowerCase().includes(q);

      let matchesAction = true;
      if (actionFilter === 'RECEIVED') matchesAction = a.actionLabel === 'Stock Received';
      else if (actionFilter === 'ADJUSTED') matchesAction = a.actionLabel === 'Stock Adjusted';
      else if (actionFilter === 'DEDUCTED') matchesAction = a.actionLabel === 'Stock Deducted';

      let matchesDate = true;
      if (dateFilter === 'TODAY') matchesDate = a.timestamp.toDateString() === todayStr;
      else if (dateFilter === 'YESTERDAY') matchesDate = a.timestamp.toDateString() === yesterdayStr;
      else if (dateFilter === 'LAST_7') matchesDate = a.timestamp >= sevenDaysAgo;
      else if (dateFilter === 'LAST_30') matchesDate = a.timestamp >= thirtyDaysAgo;

      return matchesSearch && matchesAction && matchesDate;
    });
  }, [activities, searchQuery, actionFilter, dateFilter]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card-bg)] border border-[var(--border-color)] p-5 sm:p-6 rounded-3xl shadow-xl">
        <div>
          <h2 className="text-xl font-black text-[var(--text-main)] font-display flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-purple-500/10 text-purple-400">📜</span>
            Activity Logs
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            See what changed and when.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)]/60 border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] block">Today's Activity</span>
          <div className="text-2xl font-black text-purple-400 font-mono">{summary.todayCount} activities</div>
          <div className="text-[10px] text-[var(--text-muted)]">Recorded today</div>
        </div>

        <div className="bg-[var(--card-bg)]/60 border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] block">Stock Received</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">{summary.receivingsCount}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Shipments processed</div>
        </div>

        <div className="bg-[var(--card-bg)]/60 border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] block">Stock Adjustments</span>
          <div className="text-2xl font-black text-amber-400 font-mono">{summary.adjustmentsCount}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Spoilage & corrections</div>
        </div>

        <div className="bg-[var(--card-bg)]/60 border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] block">Total Events</span>
          <div className="text-2xl font-black text-[var(--text-main)] font-mono">{activities.length}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Audit trail history</div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity by item, user, ref, action..."
            className="w-full pl-9 pr-4 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-bold"
          />
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs font-bold text-[var(--text-muted)]">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="RECEIVED">Stock Received</option>
              <option value="ADJUSTED">Stock Adjusted</option>
              <option value="DEDUCTED">Stock Deducted (POS)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <span>Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7">Last 7 Days</option>
              <option value="LAST_30">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-[var(--text-muted)] text-xs space-y-2">
            <History className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="font-bold text-[var(--text-main)] text-sm">No activity yet</p>
            <p className="text-[var(--text-muted)]">Important inventory and system actions will appear here automatically.</p>
          </div>
        ) : (
          filteredActivities.map((act) => {
            const IconComp = act.icon;

            return (
              <div
                key={act.id}
                onClick={() => setSelectedLogDetails(act)}
                className="bg-[var(--bg-color)]/60 hover:bg-[var(--bg-color)] border border-[var(--border-color)] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-2xl border ${act.badgeColor} shrink-0 mt-0.5 sm:mt-0`}>
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs text-[var(--text-main)] group-hover:text-orange-400 transition-colors">
                        {act.userName}
                      </strong>
                      <span className="text-xs text-[var(--text-muted)] lowercase">{act.actionLabel.toLowerCase()}</span>
                    </div>

                    <div className="text-xs font-bold text-[var(--text-main)]">
                      {act.itemName}
                      <span className="ml-2 font-mono text-amber-400">{act.changeQty}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                      <span>Ref: <strong>{act.reference}</strong></span>
                      {act.reason && (
                        <>
                          <span>•</span>
                          <span>Reason: <strong>{act.reason}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-right">
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">
                    <div className="font-bold text-[var(--text-main)]">{act.timeFormatted}</div>
                    <div>{act.dateFormatted}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Activity Details Modal via Portal */}
      {selectedLogDetails && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--text-main)]">{selectedLogDetails.actionLabel}</h3>
                <span className="text-[10px] text-purple-400 font-bold uppercase">{selectedLogDetails.dateFormatted} at {selectedLogDetails.timeFormatted}</span>
              </div>
              <button onClick={() => setSelectedLogDetails(null)} className="p-1.5 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[var(--bg-color)] p-4 rounded-2xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">User / Staff:</span>
                <strong className="text-[var(--text-main)]">{selectedLogDetails.userName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Item:</span>
                <strong className="text-[var(--text-main)]">{selectedLogDetails.itemName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Quantity Change:</span>
                <strong className="text-amber-400">{selectedLogDetails.changeQty}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Reference Number:</span>
                <strong className="text-orange-400">{selectedLogDetails.reference}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Explanation / Reason:</span>
                <strong className="text-[var(--text-main)]">{selectedLogDetails.reason}</strong>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => setSelectedLogDetails(null)} className="px-4 py-2 rounded-xl bg-[var(--bg-color)] font-bold text-xs text-[var(--text-muted)] cursor-pointer">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminActivityLogsView;

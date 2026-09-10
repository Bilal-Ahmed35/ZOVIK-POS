import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Download,
  Printer,
  User,
  Clock,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';

const AdminAuditLogsView = ({ logs = [], loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const handleExportCSV = () => {
    const csvData = filteredLogs.map((l) => ({
      User: l.user?.name || l.user?.email || 'System',
      Role: l.user?.role || 'SYSTEM',
      Action: l.action,
      Entity: l.entity,
      EntityID: l.entityId || 'N/A',
      IPAddress: l.ipAddress || '127.0.0.1',
      Timestamp: new Date(l.createdAt).toLocaleString(),
    }));

    exportToCSV(`audit_logs_${Date.now()}.csv`, csvData, [
      { key: 'User', label: 'User Name' },
      { key: 'Role', label: 'Role' },
      { key: 'Action', label: 'Action Trail' },
      { key: 'Entity', label: 'Target Entity' },
      { key: 'EntityID', label: 'Entity ID' },
      { key: 'IPAddress', label: 'IP Address' },
      { key: 'Timestamp', label: 'Timestamp' },
    ]);
  };

  const handleExportPDF = () => {
    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Entity ID</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${filteredLogs
            .map(
              (l) => `
            <tr>
              <td><strong>${l.user?.name || 'System'}</strong></td>
              <td>${l.user?.role || 'SYSTEM'}</td>
              <td><span class="badge badge-success">${l.action}</span></td>
              <td>${l.entity}</td>
              <td>${l.entityId || 'N/A'}</td>
              <td>${new Date(l.createdAt).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    printPDFReport('System Immutable Audit Logs Report', tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">System Immutable Audit Logs</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Tamper-proof audit trails for administrative, staff, and order actions.</p>
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search action, entity, user..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)] animate-pulse">
            Loading Audit Logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)]">
            No audit logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Entity ID</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                    <td className="p-4 font-bold text-[var(--text-main)]">{log.user?.name || log.user?.email || 'System'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {log.user?.role || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-extrabold text-emerald-400">{log.action}</td>
                    <td className="p-4 text-[var(--text-main)] font-semibold">{log.entity}</td>
                    <td className="p-4 font-mono text-[var(--text-muted)]">{log.entityId || 'N/A'}</td>
                    <td className="p-4 font-mono text-[11px] text-[var(--text-muted)]">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="p-4 text-[11px] text-[var(--text-muted)]">{new Date(log.createdAt).toLocaleString()}</td>
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

export default AdminAuditLogsView;

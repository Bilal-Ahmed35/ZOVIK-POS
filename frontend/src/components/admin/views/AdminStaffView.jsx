import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Search,
  X,
  RefreshCw,
  ShieldCheck,
  ChefHat,
  CreditCard,
  Crown,
  Lock,
  Mail,
  UserCheck,
  UserX,
} from 'lucide-react';
import api from '../../../services/api';

const ROLE_CONFIG = {
  ADMIN: {
    label: 'System Administrator',
    shortLabel: 'Admin',
    icon: Crown,
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  VENDOR: {
    label: 'Cashier / Vendor',
    shortLabel: 'Cashier',
    icon: CreditCard,
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  KITCHEN: {
    label: 'Kitchen Staff',
    shortLabel: 'Kitchen',
    icon: ChefHat,
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
};

const ROLES_LIST = [
  { value: 'ADMIN', label: 'System Administrator', desc: 'Full access to all analytics, inventory, and system settings' },
  { value: 'VENDOR', label: 'Cashier / Vendor', desc: 'Manage live orders, accept payments, and assist customers' },
  { value: 'KITCHEN', label: 'Kitchen Staff', desc: 'View live KDS kitchen orders and update preparation status' },
];

const StaffAvatar = ({ name, role }) => {
  const roleColorMap = {
    ADMIN: 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-500/20',
    VENDOR: 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/20',
    KITCHEN: 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-amber-500/20',
  };
  const colorClass = roleColorMap[role] || 'bg-slate-600 text-white';

  return (
    <div className={`w-9 h-9 rounded-xl ${colorClass} font-black flex items-center justify-center text-xs flex-shrink-0 shadow-md ring-2 ring-white/10`}>
      {name ? name.charAt(0).toUpperCase() : 'S'}
    </div>
  );
};

const AdminStaffView = ({ showToast }) => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'VENDOR' });
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [newRole, setNewRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/staff');
      setStaffList(res.data.staff || []);
    } catch (err) {
      if (showToast) showToast('Failed to load staff list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // ── Create Staff ──────────────────────────────────────────────────────────
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post('/admin/staff', formData);
      if (showToast) showToast('Staff account created & synced with Supabase Auth!');
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'VENDOR' });
      fetchStaff();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to create staff account', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Toggle Activate / Deactivate ─────────────────────────────────────────
  const handleToggleStatus = async (staff) => {
    try {
      await api.put(`/admin/staff/${staff.id}/status`, { isActive: !staff.isActive });
      if (showToast) showToast(`Staff account ${!staff.isActive ? 'activated' : 'deactivated'} successfully!`);
      fetchStaff();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  // ── Reset Password ────────────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !resetPasswordInput) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/staff/${selectedStaff.id}/reset-password`, { password: resetPasswordInput });
      if (showToast) showToast(`Password reset successfully for ${selectedStaff.name}!`);
      setShowResetModal(false);
      setResetPasswordInput('');
      setSelectedStaff(null);
    } catch (err) {
      if (showToast) showToast('Failed to reset password', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Change Role ───────────────────────────────────────────────────────────
  const handleChangeRole = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !newRole) return;
    setActionLoading(true);
    try {
      await api.put(`/admin/staff/${selectedStaff.id}/role`, { role: newRole });
      if (showToast) showToast(`Role updated to ${newRole} for ${selectedStaff.name}!`);
      setShowRoleModal(false);
      setSelectedStaff(null);
      setNewRole('');
      fetchStaff();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || 'Failed to update role', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openRoleModal = (staff) => {
    setSelectedStaff(staff);
    setNewRole(staff.role);
    setShowRoleModal(true);
  };

  const filteredStaff = staffList.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>Staff Accounts &amp; Authorization</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 ml-10">
            Manage administrative, cashier, and kitchen credentials synced directly with Supabase.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={fetchStaff}
            className="p-2.5 rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md hover:shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Staff</span>
          </button>
        </div>
      </div>

      {/* ── Search and Counter ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
          />
        </div>
        <div className="text-xs font-medium text-[var(--text-muted)] px-1">
          Showing <span className="font-bold text-[var(--text-main)]">{filteredStaff.length}</span> staff member{filteredStaff.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Modern Staff Table ──────────────────────────────────────────────── */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs font-semibold text-[var(--text-muted)]">Loading staff directory...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-color)] border border-[var(--border-color)] flex items-center justify-center">
              <Users className="w-6 h-6 text-[var(--text-muted)] opacity-50" />
            </div>
            <p className="text-xs font-bold text-[var(--text-muted)]">No staff accounts found matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/70 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
                  <th className="py-3.5 px-5">Staff Member</th>
                  <th className="py-3.5 px-5">Email Address</th>
                  <th className="py-3.5 px-5">Assigned Role</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Created Date</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredStaff.map((staff) => {
                  const roleConfig = ROLE_CONFIG[staff.role] || {
                    label: staff.role,
                    icon: Shield,
                    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                    iconColor: 'text-slate-500',
                  };
                  const RoleIcon = roleConfig.icon;

                  return (
                    <tr key={staff.id} className="hover:bg-[var(--bg-color)]/50 transition-colors group">
                      {/* Name + Avatar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <StaffAvatar name={staff.name} role={staff.role} />
                          <div>
                            <div className="font-bold text-[var(--text-main)] text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {staff.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] sm:hidden font-normal">
                              {staff.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-5 font-normal text-[var(--text-muted)] text-xs">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                          <span>{staff.email}</span>
                        </div>
                      </td>

                      {/* Role Badge (Fixed whitespace & padding) */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${roleConfig.badgeBg}`}>
                          <RoleIcon className={`w-3.5 h-3.5 ${roleConfig.iconColor}`} />
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {staff.isActive !== false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-5 text-xs text-[var(--text-muted)] font-normal whitespace-nowrap">
                        {new Date(staff.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Change Role */}
                          <button
                            onClick={() => openRoleModal(staff)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/50 dark:hover:bg-violet-900/50 border border-violet-200 dark:border-violet-800 transition-all cursor-pointer whitespace-nowrap"
                            title="Change Role"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                            <span>Role</span>
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedStaff(staff);
                              setShowResetModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer whitespace-nowrap"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                            <span>Password</span>
                          </button>

                          {/* Activate / Deactivate */}
                          <button
                            onClick={() => handleToggleStatus(staff)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                              staff.isActive !== false
                                ? 'text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 border-rose-200 dark:border-rose-800'
                                : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800'
                            }`}
                            title={staff.isActive !== false ? 'Deactivate Account' : 'Activate Account'}
                          >
                            {staff.isActive !== false ? (
                              <>
                                <UserX className="w-3.5 h-3.5 text-rose-500" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Add Staff
      ══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}
        >
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">Add New Staff Member</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Account will sync to Supabase Auth automatically</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-color)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@zovikpos.com"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1.5">Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1.5">Assign Role *</label>
                <div className="grid grid-cols-1 gap-2">
                  {ROLES_LIST.map((r) => {
                    const cfg = ROLE_CONFIG[r.value];
                    const Icon = cfg.icon;
                    const isSelected = formData.role === r.value;
                    return (
                      <label
                        key={r.value}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                            : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="addRole"
                          value={r.value}
                          checked={isSelected}
                          onChange={() => setFormData({ ...formData, role: r.value })}
                          className="accent-indigo-600"
                        />
                        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                        <div className="flex-1">
                          <div className="font-bold text-[var(--text-main)] text-xs">{r.label}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{r.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Reset Password
      ══════════════════════════════════════════════════════════════════════ */}
      {showResetModal && selectedStaff && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowResetModal(false)}
        >
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">Reset Staff Password</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">{selectedStaff.name} ({selectedStaff.email})</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-color)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-1.5">New Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Enter new password (min 6 characters)..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Change Role
      ══════════════════════════════════════════════════════════════════════ */}
      {showRoleModal && selectedStaff && (
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowRoleModal(false)}
        >
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)]">Change Authorization Role</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">{selectedStaff.name} · current: <span className="font-bold text-violet-600 dark:text-violet-400">{selectedStaff.role}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-color)] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangeRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-main)] mb-2">Select New Role *</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {ROLES_LIST.map((r) => {
                    const cfg = ROLE_CONFIG[r.value];
                    const Icon = cfg.icon;
                    const isSelected = newRole === r.value;
                    return (
                      <label
                        key={r.value}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-950/40 ring-1 ring-violet-500'
                            : 'border-[var(--border-color)] bg-[var(--bg-color)] hover:border-violet-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="roleUpdate"
                          value={r.value}
                          checked={isSelected}
                          onChange={() => setNewRole(r.value)}
                          className="accent-violet-600"
                        />
                        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                        <div className="flex-1">
                          <div className="font-bold text-[var(--text-main)] text-xs">{r.label}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">{r.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || newRole === selectedStaff.role}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Update Role</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStaffView;

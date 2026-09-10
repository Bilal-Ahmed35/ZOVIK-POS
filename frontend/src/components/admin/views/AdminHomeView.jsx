import React from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  BrainCircuit,
  Package,
  CreditCard,
  ChefHat,
  AlertTriangle,
  ArrowUpRight,
  Flame,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const AdminHomeView = ({ stats, period, setPeriod, onNavigate, onRecalculateAI, forecastingLoading }) => {
  if (!stats) {
    return (
      <div className="py-16 text-center text-xs font-bold text-[var(--text-muted)] animate-pulse">
        Loading Executive Dashboard Analytics...
      </div>
    );
  }

  const metrics = stats.metrics || {};
  const mockRevenueChart = [
    { label: '09:00 AM', revenue: metrics.totalRevenue * 0.15 },
    { label: '11:00 AM', revenue: metrics.totalRevenue * 0.35 },
    { label: '01:00 PM', revenue: metrics.totalRevenue * 0.70 },
    { label: '03:00 PM', revenue: metrics.totalRevenue * 0.85 },
    { label: '05:00 PM', revenue: metrics.totalRevenue * 0.95 },
    { label: '07:00 PM', revenue: metrics.totalRevenue },
  ];

  return (
    <div className="space-y-8">
      {/* Top Header Controls & Date Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 backdrop-blur-xl border border-[var(--border-color)] p-4 sm:p-6 rounded-2xl shadow-xl">
        <div>
          <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md text-[10px] font-extrabold tracking-wider uppercase">
            Overview Summary
          </span>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] mt-1 font-display">Executive Dashboard</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time revenue, active orders queue, stock health alerts, and AI performance.</p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center space-x-1.5 bg-[var(--bg-color)] p-1 rounded-xl border border-[var(--border-color)]">
          {[
            { id: 'day', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'year', label: 'This Year' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                period === item.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Today's Revenue */}
        <div className="bg-[var(--card-bg)]/50 backdrop-blur-xl border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-[var(--text-main)] font-mono">Rs. {metrics.totalRevenue?.toFixed(2) || '0.00'}</h3>
            <span className="text-[10px] text-emerald-400 font-bold flex items-center mt-1">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Verified Sales ({period})
            </span>
          </div>
        </div>

        {/* Active Orders Queue */}
        <div className="bg-[var(--card-bg)]/50 backdrop-blur-xl border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Active Orders</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-[var(--text-main)] font-mono">{metrics.activeOrdersCount || 0} Orders</h3>
            <span className="text-[10px] text-indigo-400 font-bold block mt-1">Pending Handoff / Preparation</span>
          </div>
        </div>

        {/* AI ETA Accuracy */}
        <div className="bg-[var(--card-bg)]/50 backdrop-blur-xl border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">AI ETA Accuracy</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-purple-400 font-mono">{metrics.etaAccuracy || 94.2}%</h3>
            <span className="text-[10px] text-[var(--text-muted)] block mt-1">Avg Prep Time: {metrics.avgPrepTime || 8.5} mins</span>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-[var(--card-bg)]/50 backdrop-blur-xl border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Stock Health Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-amber-400 font-mono">{metrics.lowStockCount || 0} Items</h3>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-[10px] text-amber-400 hover:underline font-bold block mt-1 cursor-pointer"
            >
              View Low Stock Alerts →
            </button>
          </div>
        </div>
      </div>

      {/* Main Charts & Summaries Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left: Revenue Trend Chart */}
        <div className="lg:col-span-8 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-base text-[var(--text-main)] font-display">Revenue Overview</h3>
              <p className="text-xs text-[var(--text-muted)]">Accumulated earnings trend for current period.</p>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              Full Financial Reports →
            </button>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRevenueChart}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--text-main)',
                  }}
                  formatter={(value) => [`Rs. ${Number(value).toFixed(2)}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Quick Action Alerts Panel */}
        <div className="lg:col-span-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-base text-[var(--text-main)] font-display flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Action Alerts</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400 uppercase">
                {stats.lowStockAlerts?.length || 0} URGENT
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Critical operations requiring admin review.</p>

            <div className="space-y-3 mt-4">
              {stats.lowStockAlerts?.slice(0, 3).map((item, idx) => (
                <div key={idx} className="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <strong className="text-[var(--text-main)] block font-bold">{item.name}</strong>
                    <span className="text-[10px] text-amber-400 font-bold">{item.statusLevel} ({item.stockLevel} {item.unit})</span>
                  </div>
                  <button
                    onClick={() => onNavigate('inventory')}
                    className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-500 transition-all cursor-pointer"
                  >
                    Restock
                  </button>
                </div>
              ))}

              {(!stats.lowStockAlerts || stats.lowStockAlerts.length === 0) && (
                <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-color)]/40 rounded-xl border border-dashed border-[var(--border-color)]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <span>All inventory stock levels are healthy.</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('notifications')}
            className="w-full py-2.5 bg-[var(--bg-color)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-bold text-xs rounded-xl border border-[var(--border-color)] transition-all cursor-pointer text-center"
          >
            View All System Alerts →
          </button>
        </div>
      </div>

      {/* AI Recommendations & Top Selling Products */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Top Selling Menu Items</span>
            </h3>
            <button onClick={() => onNavigate('menu')} className="text-xs text-indigo-400 hover:underline font-bold cursor-pointer">
              Manage Catalog →
            </button>
          </div>

          <div className="divide-y divide-[var(--border-color)]">
            {stats.topItems?.map((item, idx) => (
              <div key={idx} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <strong className="text-[var(--text-main)] block font-bold">{item.name}</strong>
                  <span className="text-[var(--text-muted)] text-[10px]">Category: {item.category}</span>
                </div>
                <div className="text-right">
                  <strong className="text-indigo-400 font-bold">{item.quantity} sold</strong>
                  <span className="text-[10px] text-[var(--text-muted)] block">Rs. {item.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Reorder Advice */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
              <span>AI Inventory Recommendations</span>
            </h3>
            <button
              onClick={onRecalculateAI}
              disabled={forecastingLoading}
              className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${forecastingLoading ? 'animate-spin' : ''}`} />
              <span>{forecastingLoading ? 'Calculating...' : 'Recalculate AI'}</span>
            </button>
          </div>

          <div className="divide-y divide-[var(--border-color)]">
            {stats.stockRecommendations?.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-4">All inventory stock levels are healthy.</p>
            ) : (
              stats.stockRecommendations?.map((rec, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <strong className="text-[var(--text-main)] block font-bold">{rec.name}</strong>
                    <span className="text-[var(--text-muted)] text-[10px]">Current: {rec.currentStock} (Threshold: {rec.threshold})</span>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold ${
                      rec.urgency === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      +{rec.recommendedReorder} units advised
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomeView;

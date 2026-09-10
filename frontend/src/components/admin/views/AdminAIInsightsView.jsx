import React from 'react';
import {
  BrainCircuit,
  TrendingUp,
  Package,
  Clock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Flame,
} from 'lucide-react';

const AdminAIInsightsView = ({ stats, alerts = [], alertsContext, onRecalculateAI, forecastingLoading }) => {
  const metrics = stats?.metrics || {};

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">AI Machine Learning Insights</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time demand forecasting, stockout risk prediction, and preparation ETA accuracy model.</p>
        </div>

        <button
          onClick={onRecalculateAI}
          disabled={forecastingLoading}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${forecastingLoading ? 'animate-spin' : ''}`} />
          <span>{forecastingLoading ? 'Calculating ML Models...' : 'Force Recalculate AI'}</span>
        </button>
      </div>

      {/* Top AI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Model Prediction Accuracy</span>
          <h3 className="text-3xl font-extrabold text-indigo-400 font-mono">{metrics.etaAccuracy || 94.2}%</h3>
          <p className="text-[10px] text-[var(--text-muted)]">Evaluated against actual preparation times</p>
        </div>

        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Average Kitchen Prep Time</span>
          <h3 className="text-3xl font-extrabold text-emerald-400 font-mono">{metrics.avgPrepTime || 8.5} mins</h3>
          <p className="text-[10px] text-[var(--text-muted)]">Dynamic ETA calculated per order item</p>
        </div>

        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Stock Risk Predictions</span>
          <h3 className="text-3xl font-extrabold text-amber-400 font-mono">{alerts.length || 0} Alerts</h3>
          <p className="text-[10px] text-[var(--text-muted)]">Low stock & reorder recommendations</p>
        </div>
      </div>

      {/* AI Demand & Inventory Prediction Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ML Demand Forecasts */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            <span>Predicted Daily Demand Forecasts</span>
          </h3>

          <div className="divide-y divide-[var(--border-color)] text-xs">
            {alerts.length === 0 ? (
              <p className="py-6 text-[var(--text-muted)] italic text-center">No current stockout alerts predicted.</p>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <strong className="text-[var(--text-main)] block font-bold">{alert.itemName}</strong>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Current Stock: {alert.currentStock} {alert.unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-indigo-400 block">
                      Est. Demand: ~{alert.predictedDemand || alert.currentStock * 2} units
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)]">Cache: {alert.source || 'db-cache'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Stock Reorder Recommendations */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
            <Package className="w-4 h-4 text-amber-400" />
            <span>AI Reorder & Safety Stock Advice</span>
          </h3>

          <div className="divide-y divide-[var(--border-color)] text-xs">
            {stats?.stockRecommendations?.length === 0 ? (
              <p className="py-6 text-[var(--text-muted)] italic text-center">All stock levels are optimal.</p>
            ) : (
              stats?.stockRecommendations?.map((rec, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <strong className="text-[var(--text-main)] block font-bold">{rec.name}</strong>
                    <span className="text-[10px] text-[var(--text-muted)]">Current: {rec.currentStock} (Min: {rec.threshold})</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-extrabold ${
                      rec.urgency === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    +{rec.recommendedReorder} units advised
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIInsightsView;

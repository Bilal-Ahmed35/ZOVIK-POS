import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  Package,
  Clock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Flame,
  ShieldCheck,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import api from '../../../services/api';

const AdminAIInsightsView = ({ stats, alerts = [], selectedBranchId = 'all', onRecalculateAI, forecastingLoading }) => {
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchAIInsights = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qParams = [];
      if (selectedBranchId && selectedBranchId !== 'all') qParams.push(`branchId=${selectedBranchId}`);
      if (forceRefresh) qParams.push('forceRefresh=true');
      const queryString = qParams.length > 0 ? `?${qParams.join('&')}` : '';

      const res = await api.get(`/inventory/ai-insights${queryString}`);
      if (res.data?.insights) {
        setAiData(res.data.insights);
        if (res.data.aiAvailable === false) {
          setErrorMsg(res.data.aiErrorMessage || 'AI analysis is temporarily unavailable.');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch AI insights:', err.message);
      setErrorMsg('AI analysis is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIInsights();
  }, [selectedBranchId]);

  const handleRefresh = async () => {
    if (onRecalculateAI) await onRecalculateAI();
    await fetchAIInsights(true);
  };

  const riskAlerts = aiData?.stockRiskAlerts || alerts || [];
  const optimizations = aiData?.foodCostOptimization || [];

  const accuracyText = aiData?.accuracyLabel || (stats?.metrics?.accuracyLabel || 'Not Enough Data');
  const accuracyHelper = aiData?.accuracyHelper || (stats?.metrics?.accuracyHelper || 'Prediction accuracy will appear after enough forecast history is available.');

  const prepTimeText = aiData?.avgPrepTimeLabel || (stats?.metrics?.avgPrepTimeLabel || (aiData?.avgPrepTimeMins ? `${aiData.avgPrepTimeMins} mins` : 'Not Enough Data'));
  const prepTimeSubtext = aiData?.isActualPrepTime ? 'Dynamic queue-aware actual prep time' : 'Average configured menu item prep time';

  const confidenceScore = aiData?.posConfidenceScore || (stats?.metrics?.posConfidenceScore || 'LOW — Limited Data');
  const confidenceExplanation = aiData?.posConfidenceExplanation || (stats?.metrics?.posConfidenceExplanation || 'Based on available POS transaction history');

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">
              AI Groq ML Insights & Demand Forecasting
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Real-time demand forecasting derived strictly from historical POS transaction data, stockout risk prediction, and Groq LLM intelligence.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading || forecastingLoading}
          className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || forecastingLoading) ? 'animate-spin' : ''}`} />
          <span>{(loading || forecastingLoading) ? 'Analyzing Real Data...' : 'Recalculate AI Demand Models'}</span>
        </button>
      </div>

      {/* Loading Banner */}
      {(loading || forecastingLoading) && (
        <div className="bg-orange-500/10 border border-orange-500/30 p-6 rounded-2xl flex items-center justify-center space-x-3 text-orange-400 font-bold text-sm shadow-inner animate-pulse">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Analyzing Real Data...</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMsg && !loading && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs cursor-pointer shadow-md transition-all"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Executive Summary Alert Banner */}
      {aiData?.executiveSummary && !loading && (
        <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl flex items-start space-x-3 text-xs text-orange-300">
          <Lightbulb className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold block text-sm text-orange-200">Executive AI Summary</strong>
            <p className="mt-0.5 text-orange-300/90 leading-relaxed">{aiData.executiveSummary}</p>
          </div>
        </div>
      )}

      {/* Top AI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Model Prediction Accuracy</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-orange-400 font-mono">{accuracyText}</h3>
          <p className="text-[10px] text-[var(--text-muted)]">{accuracyHelper}</p>
        </div>

        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Average Kitchen Prep Time</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">{prepTimeText}</h3>
          <p className="text-[10px] text-[var(--text-muted)]">{prepTimeSubtext}</p>
        </div>

        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">Stock Risk Predictions</span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">{riskAlerts.length} Alerts</h3>
          <p className="text-[10px] text-[var(--text-muted)]">Low stock & stockout risk notifications</p>
        </div>

        <div className="bg-[var(--card-bg)]/50 border border-[var(--border-color)] p-5 rounded-2xl shadow-lg space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">POS Data Confidence</span>
          <h3 className={`text-2xl sm:text-3xl font-extrabold font-mono ${
            confidenceScore.includes('HIGH') ? 'text-emerald-400' : confidenceScore.includes('MEDIUM') ? 'text-amber-400' : 'text-orange-400'
          }`}>
            {confidenceScore}
          </h3>
          <p className="text-[10px] text-[var(--text-muted)]">{confidenceExplanation}</p>
        </div>
      </div>

      {/* AI Demand & Inventory Prediction Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ML Demand Forecasts */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-orange-400" />
            <span>Projected Item Demand Forecasts</span>
          </h3>

          <div className="divide-y divide-[var(--border-color)] text-xs">
            {riskAlerts.length === 0 ? (
              <p className="py-8 text-[var(--text-muted)] italic text-center">No urgent stockout alerts predicted. Inventory levels are healthy.</p>
            ) : (
              riskAlerts.map((alert, idx) => (
                <div key={idx} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                      <strong className="text-[var(--text-main)] font-bold">{alert.name || alert.itemName}</strong>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                          alert.confidenceBadge === 'HIGH'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : alert.confidenceBadge === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        }`}
                      >
                        {alert.confidenceBadge || 'HIGH'} CONFIDENCE
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{alert.message}</p>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Current: {alert.currentStock} {alert.unit} | Safety Min: {alert.minThreshold} {alert.unit}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono font-extrabold text-orange-400 block text-xs">
                      {alert.forecastLabel || (alert.forecast > 0 ? `~${alert.forecast} ${alert.unit}` : 'Insufficient Sales History')}
                    </span>
                    {alert.suggestedRestock > 0 && (
                      <span className="text-[10px] font-bold text-amber-400 block mt-1">
                        Advise +{alert.suggestedRestock} {alert.unit} restock
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Food Cost & Supply Chain Optimizations */}
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl space-y-4">
          <h3 className="text-sm font-black text-[var(--text-main)] flex items-center space-x-2">
            <Package className="w-4 h-4 text-amber-400" />
            <span>AI Food Cost & Margin Optimizations</span>
          </h3>

          <div className="divide-y divide-[var(--border-color)] text-xs">
            {optimizations.length === 0 ? (
              <div className="py-8 text-[var(--text-muted)] italic text-center space-y-1">
                <p className="font-bold text-xs">Not Enough Cost Data</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Cost optimizations will appear as recipe costs and purchase transactions accumulate.
                </p>
              </div>
            ) : (
              optimizations.map((opt, idx) => (
                <div key={idx} className="py-3.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <strong className="text-[var(--text-main)] font-bold text-xs">{opt.title}</strong>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                      opt.impact === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {opt.impact || 'Medium'} Impact
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{opt.description}</p>
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

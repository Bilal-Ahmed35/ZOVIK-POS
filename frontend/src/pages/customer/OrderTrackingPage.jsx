import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Utensils,
  ArrowLeft,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const OrderTrackingPage = () => {
  const { trackingToken } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Table Change State
  const [availableTables, setAvailableTables] = useState([]);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [targetTable, setTargetTable] = useState('');
  const [tableUpdateLoading, setTableUpdateLoading] = useState(false);
  const [tableUpdateSuccess, setTableUpdateSuccess] = useState('');

  useEffect(() => {
    fetchOrder();
    api.get('/tables/active').then(r => {
      if (r.data?.tables) setAvailableTables(r.data.tables);
    }).catch(() => { });

    const socket = getSocket();
    if (socket) {
      const handleUpdate = (updatedOrder) => {
        if (order && (updatedOrder.id === order.id || updatedOrder.trackingToken === trackingToken)) {
          setOrder(updatedOrder);
        }
      };
      socket.on('order:update', handleUpdate);
      return () => socket.off('order:update', handleUpdate);
    }
  }, [trackingToken, order?.id]);

  const handleTableChange = async () => {
    if (!targetTable || !order) return;
    setTableUpdateLoading(true);
    try {
      const res = await api.put(`/orders/${order.id}/transfer-table`, {
        targetTableNumber: targetTable,
      });
      if (res.data?.order) {
        setOrder(res.data.order);
        setTableUpdateSuccess(`🍽️ Order rerouted to ${targetTable}! Kitchen notified.`);
        setShowTablePicker(false);
        setTimeout(() => setTableUpdateSuccess(''), 5000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update delivery table.');
    } finally {
      setTableUpdateLoading(false);
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/track/${encodeURIComponent(trackingToken)}`);
      setOrder(res.data.order);
      setTargetTable(res.data.order?.tableNumber || '');
    } catch (err) {
      console.error('Tracking fetch error:', err);
      setError(err.response?.data?.error || 'Order tracking not found.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'PENDING', label: 'Placed', icon: ShoppingBag },
    { key: 'PAID', label: 'Paid & Queued', icon: ShieldCheck },
    { key: 'PREPARING', label: 'In Kitchen', icon: Utensils },
    { key: 'READY', label: 'Ready for Pickup', icon: Sparkles },
    { key: 'COMPLETED', label: 'Handed Over', icon: CheckCircle2 },
  ];

  const getStepIndex = (status) => {
    if (status === 'PAYMENT_PENDING') return 0;
    if (status === 'PAID') return 1;
    if (status === 'PREPARING') return 2;
    if (status === 'READY') return 3;
    if (status === 'COMPLETED') return 4;
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500 font-bold">Loading Live Order Tracker...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-gray-900">Order Not Found</h2>
          <p className="text-xs text-gray-500">{error || 'This order tracking code is invalid or expired.'}</p>
          <button
            onClick={() => navigate('/customer')}
            className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold text-xs hover:bg-orange-500 transition-all cursor-pointer"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(order.status);
  const etaMins = order.etaPrediction?.adjustedEta ? Math.round(order.etaPrediction.adjustedEta) : 10;

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-gray-900 font-sans p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
      <div className="max-w-2xl w-full mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/customer')}
            className="inline-flex items-center space-x-2 text-xs font-bold text-gray-600 hover:text-orange-600 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
          <div className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-[11px] font-extrabold border border-orange-100">
            Live Tracker
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider block mb-1">
                Order Tracking
              </span>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                {order.orderNumber || `#000${order.id}`}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Delivering to: <strong className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded">{order.tableNumber || 'Takeaway'}</strong> • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                <button
                  onClick={() => setShowTablePicker(!showTablePicker)}
                  className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-800 flex items-center space-x-1 underline cursor-pointer"
                >
                  <span>📍 Changed seat? Transfer delivery to another table</span>
                </button>
              )}
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-2xl text-center sm:text-right shadow-md">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">AI Estimated Ready</span>
              <span className="text-xl font-black">~{etaMins} Mins</span>
              <span className="text-[10px] opacity-80 block">Kitchen Load: {order.etaPrediction?.kitchenLoad || 'Normal'}</span>
            </div>
          </div>

          {/* Table Transfer Notification */}
          {tableUpdateSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-fade-in">
              {tableUpdateSuccess}
            </div>
          )}

          {/* Change Table Dropdown */}
          {showTablePicker && (
            <div className="p-4 bg-orange-50/70 border border-orange-100 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-950">Select New Delivery Location:</span>
                <button onClick={() => setShowTablePicker(false)} className="text-xs text-gray-400 font-bold hover:text-gray-600">✕ Close</button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={targetTable}
                  onChange={(e) => setTargetTable(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 text-xs rounded-xl px-3 py-2 font-bold flex-1 focus:outline-none focus:border-orange-600"
                >
                  <option value="">Select Table...</option>
                  {availableTables.map(t => (
                    <option key={t.id} value={t.tableNumber}>
                      {t.tableNumber}
                    </option>
                  ))}
                </select>
                <button
                  disabled={tableUpdateLoading || !targetTable}
                  onClick={handleTableChange}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {tableUpdateLoading ? 'Updating...' : 'Update Table'}
                </button>
              </div>
            </div>
          )}

          {/* Progress Tracker */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Preparation Progress</h3>
            <div className="grid grid-cols-5 gap-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step.key} className="text-center space-y-2">
                    <div
                      className={`w-10 h-10 mx-auto rounded-2xl flex items-center justify-center transition-all ${isCurrent
                          ? 'bg-orange-600 text-white ring-4 ring-orange-100 shadow-md scale-110'
                          : isPassed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] font-bold block leading-tight ${isCurrent ? 'text-orange-600' : isPassed ? 'text-gray-800' : 'text-gray-400'
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Message */}
          <div className="p-4 bg-orange-50/70 border border-orange-100 rounded-2xl flex items-center space-x-3 text-xs text-orange-900">
            <Clock className="w-5 h-5 text-orange-600 shrink-0" />
            <div>
              <strong>Current Status: {order.status}</strong>
              <p className="text-[11px] text-orange-700 mt-0.5">
                {order.status === 'READY'
                  ? 'Your order is ready! Please collect your food from the pickup counter.'
                  : order.status === 'PREPARING'
                    ? 'Our chef is preparing your meal in the kitchen right now.'
                    : order.status === 'PAID'
                      ? 'Payment confirmed. Your ticket has been queued in the kitchen.'
                      : order.status === 'COMPLETED'
                        ? 'This order has been completed and handed over.'
                        : 'Order placed. Awaiting payment / cashier confirmation.'}
              </p>
            </div>
          </div>

          {/* Item Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Order Items</h3>
            <div className="divide-y divide-gray-100">
              {order.orderItems?.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <strong className="text-gray-800 font-bold block">{item.nameSnapshot || item.menuItem?.name}</strong>
                    <span className="text-gray-400">Qty: {item.quantity} × Rs. {(item.priceSnapshot ?? item.price ?? 0).toFixed(2)}</span>
                  </div>
                  <strong className="text-gray-900 font-bold">
                    Rs. {((item.priceSnapshot ?? item.price ?? 0) * item.quantity).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-sm font-black">
              <span>Total Amount:</span>
              <span className="text-orange-600 text-base">Rs. {order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="max-w-2xl w-full mx-auto text-center py-6 text-[11px] text-gray-400">
        ZovikPOS Smart AI Canteen System
      </footer>
    </div>
  );
};

export default OrderTrackingPage;

import React, { useState, useMemo } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Package,
  Calendar,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';

const AdminReportsView = ({ stats, orders = [], inventory = [], period, setPeriod }) => {
  const [reportType, setReportType] = useState('SALES');

  const metrics = stats?.metrics || {};

  const salesReportData = useMemo(() => {
    return orders.map((o) => ({
      OrderNumber: o.orderNumber,
      Customer: o.user?.name || o.user?.email || 'Guest',
      TotalAmount: o.total,
      PaymentMethod: o.paymentMethod,
      Status: o.status,
      Date: new Date(o.createdAt).toLocaleString(),
    }));
  }, [orders]);

  const productReportData = useMemo(() => {
    return (stats?.topItems || []).map((item) => ({
      ItemName: item.name,
      Category: item.category,
      QuantitySold: item.quantity,
      RevenueGenerated: item.revenue,
    }));
  }, [stats]);

  const handleExportCSV = () => {
    if (reportType === 'SALES') {
      exportToCSV(`sales_report_${period}_${Date.now()}.csv`, salesReportData, [
        { key: 'OrderNumber', label: 'Order #' },
        { key: 'Customer', label: 'Customer' },
        { key: 'TotalAmount', label: 'Total (Rs.)' },
        { key: 'PaymentMethod', label: 'Payment Method' },
        { key: 'Status', label: 'Order Status' },
        { key: 'Date', label: 'Timestamp' },
      ]);
    } else if (reportType === 'PRODUCTS') {
      exportToCSV(`product_performance_${period}_${Date.now()}.csv`, productReportData, [
        { key: 'ItemName', label: 'Item Name' },
        { key: 'Category', label: 'Category' },
        { key: 'QuantitySold', label: 'Quantity Sold' },
        { key: 'RevenueGenerated', label: 'Revenue (Rs.)' },
      ]);
    }
  };

  const handleExportPDF = () => {
    const tableHtml = `
      <h3>${reportType} REPORT (${period.toUpperCase()})</h3>
      <table>
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Total (Rs.)</th>
            <th>Method</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td><strong>${o.orderNumber}</strong></td>
              <td>${o.user?.name || o.user?.email || 'Guest'}</td>
              <td>Rs. ${o.total.toFixed(2)}</td>
              <td>${o.paymentMethod}</td>
              <td>${o.status}</td>
              <td>${new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    printPDFReport(`Executive ${reportType} Report`, tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">Executive Reports & Deep Analytics</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Generate financial sales, order distribution, and product metrics reports.</p>
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

      {/* Date Filter & Report Type Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Report Types */}
        <div className="flex items-center p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl gap-1">
          {[
            { id: 'SALES', label: 'Sales & Revenue' },
            { id: 'PRODUCTS', label: 'Product Performance' },
            { id: 'INVENTORY', label: 'Inventory Summary' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                reportType === type.id ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center space-x-1 bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--border-color)]">
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
                period === item.id ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">Revenue ({period})</span>
          <strong className="text-xl font-mono font-extrabold text-emerald-400 block mt-1">Rs. {metrics.totalRevenue?.toFixed(2)}</strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">Total Orders</span>
          <strong className="text-xl font-mono font-extrabold text-[var(--text-main)] block mt-1">{orders.length} Orders</strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">Average Order Value</span>
          <strong className="text-xl font-mono font-extrabold text-indigo-400 block mt-1">
            Rs. {orders.length > 0 ? (metrics.totalRevenue / orders.length).toFixed(2) : '0.00'}
          </strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">Low Stock Items</span>
          <strong className="text-xl font-mono font-extrabold text-amber-400 block mt-1">{metrics.lowStockCount || 0} Items</strong>
        </div>
      </div>

      {/* Detailed Data Table */}
      <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                <th className="p-4">Order #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Table</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                  <td className="p-4 font-mono font-extrabold text-indigo-400">{o.orderNumber}</td>
                  <td className="p-4 font-bold text-[var(--text-main)]">{o.user?.name || o.user?.email || 'Guest'}</td>
                  <td className="p-4">{o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway')}</td>
                  <td className="p-4 font-mono font-extrabold text-emerald-400">Rs. {o.total?.toFixed(2)}</td>
                  <td className="p-4">{o.paymentMethod}</td>
                  <td className="p-4 font-bold text-indigo-400">{o.status}</td>
                  <td className="p-4 text-[11px] text-[var(--text-muted)]">{new Date(o.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReportsView;

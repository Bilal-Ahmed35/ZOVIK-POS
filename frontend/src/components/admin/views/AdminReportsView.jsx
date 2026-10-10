import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileBarChart,
  Download,
  Printer,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Package,
  Calendar,
  X,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Building2,
  DollarSign,
  ArrowUpDown,
} from 'lucide-react';
import { exportToCSV, printPDFReport } from '../../../utils/exportUtils';

const AdminReportsView = ({
  stats,
  orders = [],
  inventory = [],
  branches = [],
  selectedBranchId = 'all',
  period,
  setPeriod,
  onRefresh,
}) => {
  const [reportType, setReportType] = useState('SALES');
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [productSort, setProductSort] = useState('UNITS_SOLD');

  const metrics = stats?.metrics || {};

  // Financial calculations from actual orders
  const completedOrders = useMemo(() => {
    return orders.filter((o) =>
      ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(o.status)
    );
  }, [orders]);

  const totalRevenueCalculated = useMemo(() => {
    return completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  }, [completedOrders]);

  const avgOrderValueCalculated = useMemo(() => {
    return completedOrders.length > 0
      ? totalRevenueCalculated / completedOrders.length
      : 0;
  }, [completedOrders, totalRevenueCalculated]);

  // Payment Breakdown from actual orders
  const paymentBreakdownData = useMemo(() => {
    if (stats?.paymentBreakdown && stats.paymentBreakdown.length > 0) {
      return stats.paymentBreakdown;
    }
    const map = { CASH: { count: 0, total: 0 }, CARD: { count: 0, total: 0 }, JAZZCASH: { count: 0, total: 0 }, EASYPAISA: { count: 0, total: 0 }, NAYAPAY: { count: 0, total: 0 } };
    completedOrders.forEach((o) => {
      const pm = (o.paymentMethod || 'CASH').toUpperCase();
      if (!map[pm]) map[pm] = { count: 0, total: 0 };
      map[pm].count += 1;
      map[pm].total += o.total || 0;
    });
    return Object.keys(map).map((method) => ({
      method,
      count: map[method].count,
      totalAmount: map[method].total,
    }));
  }, [stats, completedOrders]);

  // Product performance aggregation from real order items
  const productPerformanceRows = useMemo(() => {
    const itemMap = {};
    completedOrders.forEach((o) => {
      (o.orderItems || []).forEach((item) => {
        const name = item.nameSnapshot || item.menuItem?.name || `Item #${item.menuItemId}`;
        const cat = item.menuItem?.category || 'General';
        const price = item.priceSnapshot || item.menuItem?.price || 0;
        const qty = item.quantity || 1;
        const subtotal = item.subtotal || price * qty;

        if (!itemMap[name]) {
          let recipeCost = 0;
          if (item.menuItem?.recipeItems) {
            item.menuItem.recipeItems.forEach((r) => {
              if (r.inventoryItem) {
                recipeCost += r.quantity * (r.inventoryItem.costPrice || 0);
              }
            });
          }
          itemMap[name] = {
            name,
            category: cat,
            sellingPrice: price,
            unitsSold: 0,
            totalRevenue: 0,
            recipeCost: parseFloat(recipeCost.toFixed(2)),
          };
        }
        itemMap[name].unitsSold += qty;
        itemMap[name].totalRevenue += subtotal;
      });
    });

    const list = Object.values(itemMap).map((item) => {
      const grossMargin = item.sellingPrice - item.recipeCost;
      const marginPct = item.sellingPrice > 0 ? (grossMargin / item.sellingPrice) * 100 : 0;
      return {
        ...item,
        grossMargin: parseFloat(grossMargin.toFixed(2)),
        marginPct: parseFloat(marginPct.toFixed(1)),
      };
    });

    if (productSort === 'REVENUE') return list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    if (productSort === 'MARGIN') return list.sort((a, b) => b.marginPct - a.marginPct);
    if (productSort === 'LOW_SALES') return list.sort((a, b) => a.unitsSold - b.unitsSold);
    return list.sort((a, b) => b.unitsSold - a.unitsSold);
  }, [completedOrders, productSort]);

  // Inventory Summary Calculations
  const inventorySummaryStats = useMemo(() => {
    let totalValuation = 0;
    let lowStockCount = 0;
    let criticalCount = 0;
    let normalCount = 0;

    inventory.forEach((item) => {
      const val = (item.stockLevel || 0) * (item.costPrice || 0);
      totalValuation += val;
      if (item.stockLevel <= 0) criticalCount++;
      else if (item.stockLevel <= item.minThreshold) lowStockCount++;
      else normalCount++;
    });

    return {
      totalItems: inventory.length,
      lowStockCount,
      criticalCount,
      normalCount,
      totalValuation: Math.round(totalValuation),
    };
  }, [inventory]);

  // Handle Export CSV
  const handleExportCSV = () => {
    const timestamp = Date.now();
    if (reportType === 'SALES') {
      const exportRows = orders.map((o) => ({
        OrderNumber: o.orderNumber,
        Customer: o.user?.name || o.user?.email || 'Guest',
        Table: o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway'),
        Amount: o.total,
        PaymentMethod: o.paymentMethod,
        Status: o.status,
        Date: new Date(o.createdAt).toLocaleString(),
      }));
      exportToCSV(`sales_report_${period}_${timestamp}.csv`, exportRows, [
        { key: 'OrderNumber', label: 'Order #' },
        { key: 'Customer', label: 'Customer' },
        { key: 'Table', label: 'Table/Type' },
        { key: 'Amount', label: 'Amount (Rs.)' },
        { key: 'PaymentMethod', label: 'Payment Method' },
        { key: 'Status', label: 'Status' },
        { key: 'Date', label: 'Date/Time' },
      ]);
    } else if (reportType === 'PRODUCTS') {
      const exportRows = productPerformanceRows.map((p) => ({
        ItemName: p.name,
        Category: p.category,
        UnitsSold: p.unitsSold,
        SellingPrice: p.sellingPrice,
        RecipeCost: p.recipeCost,
        Revenue: p.totalRevenue,
        GrossMarginPct: `${p.marginPct}%`,
      }));
      exportToCSV(`product_performance_${period}_${timestamp}.csv`, exportRows, [
        { key: 'ItemName', label: 'Item Name' },
        { key: 'Category', label: 'Category' },
        { key: 'UnitsSold', label: 'Units Sold' },
        { key: 'SellingPrice', label: 'Selling Price (Rs.)' },
        { key: 'RecipeCost', label: 'Recipe Cost (Rs.)' },
        { key: 'Revenue', label: 'Revenue (Rs.)' },
        { key: 'GrossMarginPct', label: 'Gross Margin %' },
      ]);
    } else if (reportType === 'INVENTORY') {
      const exportRows = inventory.map((i) => ({
        ItemName: i.name,
        Category: i.category || 'Uncategorized',
        StockLevel: `${i.stockLevel} ${i.unit}`,
        SafetyMin: `${i.minThreshold} ${i.unit}`,
        UnitCost: i.costPrice,
        Valuation: (i.stockLevel * (i.costPrice || 0)).toFixed(2),
        Status: i.stockLevel <= 0 ? 'CRITICAL' : i.stockLevel <= i.minThreshold ? 'LOW' : 'NORMAL',
      }));
      exportToCSV(`inventory_summary_${timestamp}.csv`, exportRows, [
        { key: 'ItemName', label: 'Item Name' },
        { key: 'Category', label: 'Category' },
        { key: 'StockLevel', label: 'Current Stock' },
        { key: 'SafetyMin', label: 'Safety Min' },
        { key: 'UnitCost', label: 'Unit Cost (Rs.)' },
        { key: 'Valuation', label: 'Total Valuation (Rs.)' },
        { key: 'Status', label: 'Status' },
      ]);
    }
  };

  // Handle Export PDF
  const handleExportPDF = () => {
    let tableHtml = '';
    const dateStr = new Date().toLocaleString();
    const activeBranchName = selectedBranchId === 'all'
      ? 'All Outlets'
      : (branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Selected Branch');

    if (reportType === 'SALES') {
      tableHtml = `
        <h3>SALES & REVENUE REPORT (${period.toUpperCase()}) - ${activeBranchName}</h3>
        <p><strong>Generated:</strong> ${dateStr} | <strong>Total Revenue:</strong> Rs. ${totalRevenueCalculated.toFixed(2)} | <strong>Orders:</strong> ${completedOrders.length}</p>
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Table/Type</th>
              <th>Amount (Rs.)</th>
              <th>Method</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (o) => `
              <tr>
                <td><strong>${o.orderNumber}</strong></td>
                <td>${o.user?.name || o.user?.email || 'Guest'}</td>
                <td>${o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway')}</td>
                <td>Rs. ${Number(o.total || 0).toFixed(2)}</td>
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
    } else if (reportType === 'PRODUCTS') {
      tableHtml = `
        <h3>PRODUCT PERFORMANCE REPORT (${period.toUpperCase()}) - ${activeBranchName}</h3>
        <p><strong>Generated:</strong> ${dateStr}</p>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Units Sold</th>
              <th>Selling Price</th>
              <th>Recipe Cost</th>
              <th>Total Revenue</th>
              <th>Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${productPerformanceRows
              .map(
                (p) => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.category}</td>
                <td>${p.unitsSold}</td>
                <td>Rs. ${p.sellingPrice.toFixed(2)}</td>
                <td>Rs. ${p.recipeCost.toFixed(2)}</td>
                <td>Rs. ${p.totalRevenue.toFixed(2)}</td>
                <td>${p.marginPct}%</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'INVENTORY') {
      tableHtml = `
        <h3>INVENTORY SUMMARY REPORT - ${activeBranchName}</h3>
        <p><strong>Generated:</strong> ${dateStr} | <strong>Total Valuation:</strong> Rs. ${inventorySummaryStats.totalValuation.toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Safety Min</th>
              <th>Unit Cost (Rs.)</th>
              <th>Valuation (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${inventory
              .map(
                (i) => `
              <tr>
                <td><strong>${i.name}</strong></td>
                <td>${i.category || 'Uncategorized'}</td>
                <td>${i.stockLevel} ${i.unit}</td>
                <td>${i.minThreshold} ${i.unit}</td>
                <td>Rs. ${Number(i.costPrice || 0).toFixed(2)}</td>
                <td>Rs. ${(i.stockLevel * (i.costPrice || 0)).toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
    printPDFReport(`Executive ${reportType} Report`, tableHtml);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">
            Executive Reports & Analytics
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            100% deterministic database reports for financial revenue, product performance, and stock valuation.
          </p>
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
            className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
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
                reportType === type.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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
                period === item.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl shadow-md">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">
            Revenue ({period})
          </span>
          <strong className="text-xl font-mono font-extrabold text-emerald-400 block mt-1">
            Rs. {(metrics.totalRevenue ?? totalRevenueCalculated).toFixed(2)}
          </strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl shadow-md">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">
            Completed Orders
          </span>
          <strong className="text-xl font-mono font-extrabold text-[var(--text-main)] block mt-1">
            {metrics.totalOrdersCount ?? completedOrders.length} Orders
          </strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl shadow-md">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">
            Average Order Value
          </span>
          <strong className="text-xl font-mono font-extrabold text-orange-400 block mt-1">
            Rs. {(metrics.averageOrderValue ?? avgOrderValueCalculated).toFixed(2)}
          </strong>
        </div>
        <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-4 rounded-xl shadow-md">
          <span className="text-[10px] text-[var(--text-muted)] font-black uppercase">
            Low Stock Items
          </span>
          <strong className="text-xl font-mono font-extrabold text-amber-400 block mt-1">
            {metrics.lowStockCount ?? inventorySummaryStats.lowStockCount} Items
          </strong>
        </div>
      </div>

      {/* TAB 1: SALES & REVENUE */}
      {reportType === 'SALES' && (
        <div className="space-y-6">
          {/* Payment Method Breakdown Grid */}
          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-5 rounded-2xl shadow-xl space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-orange-400" />
              <span>Real-Time Payment Method Breakdown</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {paymentBreakdownData.map((pb, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-color)]/60 border border-[var(--border-color)] p-3 rounded-xl space-y-1"
                >
                  <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">
                    {pb.method}
                  </span>
                  <div className="text-sm font-mono font-extrabold text-emerald-400">
                    Rs. {Number(pb.totalAmount || 0).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-bold block">
                    {pb.count} transaction(s)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Orders Table */}
          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Table / Type</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date Time</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-[var(--text-muted)] italic">
                        No sales data recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedOrderModal(o)}
                        className="hover:bg-[var(--bg-color)]/40 transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-mono font-extrabold text-orange-400">
                          {o.orderNumber}
                        </td>
                        <td className="p-4 font-bold text-[var(--text-main)]">
                          {o.user?.name || o.user?.email || 'Guest Customer'}
                        </td>
                        <td className="p-4 text-[var(--text-muted)] font-medium">
                          {o.tableNumber || (o.tableId ? `Table ${o.tableId}` : 'Takeaway')}
                        </td>
                        <td className="p-4 font-mono font-extrabold text-emerald-400">
                          Rs. {Number(o.total || 0).toFixed(2)}
                        </td>
                        <td className="p-4 font-bold text-[var(--text-muted)]">
                          {o.paymentMethod || 'CASH'}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                              o.status === 'PAID' || o.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : o.status === 'PREPARING' || o.status === 'READY'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : o.status === 'CANCELLED'
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="p-4 text-[11px] text-[var(--text-muted)]">
                          {new Date(o.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderModal(o);
                            }}
                            className="p-1.5 rounded-lg bg-[var(--card-bg)] hover:bg-orange-600 hover:text-white border border-[var(--border-color)] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT PERFORMANCE */}
      {reportType === 'PRODUCTS' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex justify-between items-center bg-[var(--card-bg)]/40 p-4 rounded-xl border border-[var(--border-color)]">
            <h3 className="text-xs font-black uppercase text-[var(--text-muted)] flex items-center space-x-2">
              <Package className="w-4 h-4 text-orange-400" />
              <span>Menu Items Sales & Recipe Margins</span>
            </h3>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-[var(--text-muted)] font-bold">Sort By:</span>
              <select
                value={productSort}
                onChange={(e) => setProductSort(e.target.value)}
                className="px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg font-bold focus:outline-none cursor-pointer"
              >
                <option value="UNITS_SOLD">Best Sellers (Units Sold)</option>
                <option value="REVENUE">Highest Revenue</option>
                <option value="MARGIN">Highest Gross Margin %</option>
                <option value="LOW_SALES">Lowest Sales</option>
              </select>
            </div>
          </div>

          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Menu Item</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Units Sold</th>
                    <th className="p-4">Selling Price</th>
                    <th className="p-4">Recipe Cost</th>
                    <th className="p-4">Gross Margin (Rs.)</th>
                    <th className="p-4">Margin %</th>
                    <th className="p-4">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {productPerformanceRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-[var(--text-muted)] italic">
                        No product sales recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    productPerformanceRows.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                        <td className="p-4 font-bold text-[var(--text-main)]">{item.name}</td>
                        <td className="p-4 text-[var(--text-muted)]">{item.category}</td>
                        <td className="p-4 font-mono font-extrabold text-orange-400">
                          {item.unitsSold}
                        </td>
                        <td className="p-4 font-mono font-bold">Rs. {item.sellingPrice.toFixed(2)}</td>
                        <td className="p-4 font-mono text-[var(--text-muted)]">
                          Rs. {item.recipeCost.toFixed(2)}
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-400">
                          Rs. {item.grossMargin.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                              item.marginPct >= 60
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : item.marginPct >= 35
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {item.marginPct}%
                          </span>
                        </td>
                        <td className="p-4 font-mono font-extrabold text-emerald-400">
                          Rs. {item.totalRevenue.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY SUMMARY */}
      {reportType === 'INVENTORY' && (
        <div className="space-y-6">
          {/* Inventory Valuation Header */}
          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">
                Total Inventory Asset Valuation
              </span>
              <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-0.5">
                Rs. {inventorySummaryStats.totalValuation.toLocaleString()}
              </div>
            </div>
            <div className="flex space-x-3 text-xs font-bold">
              <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl">
                Normal: {inventorySummaryStats.normalCount}
              </span>
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl">
                Low: {inventorySummaryStats.lowStockCount}
              </span>
              <span className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
                Critical: {inventorySummaryStats.criticalCount}
              </span>
            </div>
          </div>

          <div className="bg-[var(--card-bg)]/40 border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-color)]/50 text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)]">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Safety Min</th>
                    <th className="p-4">Unit Cost</th>
                    <th className="p-4">Total Valuation</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-[var(--text-muted)] italic">
                        No inventory items available.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item) => {
                      const valuation = (item.stockLevel || 0) * (item.costPrice || 0);
                      const isLow = item.stockLevel <= item.minThreshold;
                      const isCritical = item.stockLevel <= 0;
                      return (
                        <tr key={item.id} className="hover:bg-[var(--bg-color)]/40 transition-colors">
                          <td className="p-4 font-bold text-[var(--text-main)]">{item.name}</td>
                          <td className="p-4 text-[var(--text-muted)]">{item.category || 'Uncategorized'}</td>
                          <td className="p-4 font-mono font-extrabold text-orange-400">
                            {item.stockLevel} {item.unit}
                          </td>
                          <td className="p-4 font-mono text-[var(--text-muted)]">
                            {item.minThreshold} {item.unit}
                          </td>
                          <td className="p-4 font-mono">Rs. {Number(item.costPrice || 0).toFixed(2)}</td>
                          <td className="p-4 font-mono font-extrabold text-emerald-400">
                            Rs. {valuation.toFixed(2)}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                                isCritical
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                  : isLow
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {isCritical ? 'CRITICAL' : isLow ? 'LOW STOCK' : 'NORMAL'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal via React Portal */}
      {selectedOrderModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-orange-400 font-mono">
                    {selectedOrderModal.orderNumber}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Placed on {new Date(selectedOrderModal.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrderModal(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)] font-bold">Customer:</span>
                  <span className="font-bold text-[var(--text-main)]">
                    {selectedOrderModal.user?.name || selectedOrderModal.user?.email || 'Guest'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)] font-bold">Payment Method:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedOrderModal.paymentMethod || 'CASH'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[var(--border-color)]/40">
                  <span className="text-[var(--text-muted)] font-bold">Status:</span>
                  <span className="font-bold text-orange-400">{selectedOrderModal.status}</span>
                </div>
              </div>

              {/* Itemized Order List */}
              <div className="space-y-2">
                <strong className="text-xs uppercase font-black tracking-wider text-[var(--text-muted)] block">
                  Order Items
                </strong>
                <div className="divide-y divide-[var(--border-color)] max-h-48 overflow-y-auto pr-1 text-xs">
                  {(selectedOrderModal.orderItems || []).map((item, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <strong className="text-[var(--text-main)] block">
                          {item.nameSnapshot || item.menuItem?.name}
                        </strong>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Rs. {item.priceSnapshot || item.menuItem?.price} × {item.quantity}
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-emerald-400">
                        Rs. {(item.subtotal || (item.priceSnapshot * item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
                <span className="text-xs font-black uppercase text-[var(--text-muted)]">
                  Total Order Amount
                </span>
                <span className="text-lg font-mono font-extrabold text-emerald-400">
                  Rs. {Number(selectedOrderModal.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default AdminReportsView;

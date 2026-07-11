import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery } from '@tanstack/react-query';
import { db, type LocalSale } from '../db/posDB';
import api from '../api/client';
import {
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
  BarChart3,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  startOfMonth, startOfQuarter,
  startOfYear, endOfDay, isWithinInterval
} from 'date-fns';

type ReportTab = 'Financial' | 'Staff' | 'Payment';
type TimeFilter = 'All' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';

// ─── Bar Chart ───────────────────────────────────────────────────────────────
const BarChart = ({
  data,
  label,
  valuePrefix = '',
}: {
  data: { label: string; value: number; profit?: number }[];
  label: string;
  valuePrefix?: string;
}) => {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="glass-panel border border-border/50 rounded-3xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black tracking-[0.2em] uppercase text-muted-foreground">
            {label}
          </h3>
        </div>
      </div>
      <div className="h-64 flex items-stretch justify-between gap-2 pt-4">
        {!data.some(d => d.value > 0) ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 font-black text-xs tracking-widest uppercase text-center px-4">
            No data available for this period
          </div>
        ) : (
          data.map((item, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full flex flex-col justify-end h-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(item.value / maxVal) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                  className="w-full relative flex flex-col justify-end group"
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-foreground text-background text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 flex flex-col items-center shadow-xl">
                    <span className="text-muted-foreground/80 tracking-widest uppercase">REV: {valuePrefix}{item.value.toLocaleString()}</span>
                    {item.profit !== undefined && (
                      <span className="text-success tracking-widest uppercase">PRO: {valuePrefix}{item.profit.toLocaleString()}</span>
                    )}
                  </div>

                  {item.profit !== undefined ? (
                    <div className="w-full h-full flex flex-col rounded-t-lg overflow-hidden">
                      <div 
                        className="w-full bg-success/80 transition-colors"
                        style={{ height: `${(item.profit / item.value) * 100}%` }}
                      />
                      <div 
                        className="w-full bg-primary/30 transition-colors border-t border-background/20"
                        style={{ height: `${((item.value - item.profit) / item.value) * 100}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-primary/20 group-hover:bg-primary/40 border-t-4 border-primary rounded-t-lg transition-colors relative" />
                  )}
                </motion.div>
              </div>
              <span className="text-[9px] font-black text-muted-foreground/60 truncate w-full text-center tracking-tighter uppercase">
                {item.label}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isActiveTransaction = (s: LocalSale) =>
  s.status !== 'DELETED' && s.status !== 'REFUNDED';

const getScopeInterval = (timeFilter: TimeFilter, dailyDateStr: string) => {
  const now = new Date();
  const targetDate = timeFilter === 'Daily' ? new Date(dailyDateStr) : now;
  const end = endOfDay(now);
  if (timeFilter === 'All') return { start: new Date(0), end };
  if (timeFilter === 'Daily') return { start: new Date(targetDate.setHours(0, 0, 0, 0)), end: endOfDay(targetDate) };
  // Weekly: whole current month (so we can show all weeks-of-month so far)
  if (timeFilter === 'Weekly') return { start: startOfMonth(now), end };
  // Monthly: whole current year (so we can show all months so far)
  if (timeFilter === 'Monthly') return { start: startOfYear(now), end };
  if (timeFilter === 'Quarterly') return { start: startOfQuarter(now), end };
  return { start: startOfYear(now), end };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('Financial');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Daily');
  const [dailyDate, setDailyDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // ── 1. Local live DB (instant on any change) ─────────────────────────────
  const localSales = useLiveQuery(() => db.salesQueue.toArray(), []) ?? [];
  const localProducts = useLiveQuery(() => db.products.filter(p => !p.deleted && (!p.status || p.status.toLowerCase() === 'active')).toArray(), []) ?? [];
  const localExpenses = useLiveQuery(() => db.expenses.toArray(), []) ?? [];

  // ── 2. Server transactions — polls every 30 s ─────────────────────────────
  const { data: serverSalesRaw } = useQuery({
    queryKey: ['reports-transactions', timeFilter, dailyDate],
    queryFn: async () => {
      const interval = getScopeInterval(timeFilter, dailyDate);
      const res = await api.get('/reports/transactions', {
        params: { from: interval.start.toISOString(), to: interval.end.toISOString() },
      });
      return (res.data.success ? res.data.data : []) as LocalSale[];
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 20_000,
  });

  // ── 3. Server dashboard stats — polls every 30 s ─────────────────────────
  const { data: serverStats } = useQuery({
    queryKey: ['reports-dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.success ? res.data.data : null;
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 20_000,
  });

  const { data: serverExpensesRaw } = useQuery({
    queryKey: ['reports-expenses'],
    queryFn: async () => {
      const res = await api.get('/expenses');
      return (res.data.success ? res.data.data : []);
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 20_000,
  });

  // ── 4. Merge local + server, dedupe by invoiceNo ─────────────────────────
  const allSales: LocalSale[] = useMemo(() => {
    const merged = [...localSales];
    const localInvoices = new Set(merged.map((s) => s.invoiceNo));
    (serverSalesRaw ?? []).forEach((ss) => {
      if (!localInvoices.has(ss.invoiceNo)) merged.push(ss);
    });
    return merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localSales, serverSalesRaw]);

  // ── 5. Filter by time scope ───────────────────────────────────────────────
  const scopedSales = useMemo(() => {
    const interval = getScopeInterval(timeFilter, dailyDate);
    return allSales.filter((s) =>
      isWithinInterval(new Date(s.createdAt), interval)
    );
  }, [allSales, timeFilter, dailyDate]);

  const allExpenses = useMemo(() => {
    const merged = [...localExpenses];
    const localIds = new Set(merged.map(e => e.id));
    (serverExpensesRaw ?? []).forEach((se: any) => {
      if (!localIds.has(se.id)) merged.push(se);
    });
    return merged;
  }, [localExpenses, serverExpensesRaw]);

  const scopedExpenses = useMemo(() => {
    const interval = getScopeInterval(timeFilter, dailyDate);
    return allExpenses.filter((e) =>
      isWithinInterval(new Date(e.date || e.createdAt), interval)
    );
  }, [allExpenses, timeFilter, dailyDate]);

  const totalExpenses = useMemo(
    () => scopedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [scopedExpenses]
  );

  // ── 6. Stats (exclude DELETED & REFUNDED) ────────────────────────────────
  const activeSales = useMemo(
    () => scopedSales.filter(isActiveTransaction),
    [scopedSales]
  );

  const totalRevenue = useMemo(
    () => activeSales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [activeSales]
  );
  const totalSalesCount = activeSales.length;
  const totalProfit = useMemo(
    () => activeSales.reduce((sum, s) => sum + Number(s.profit || 0), 0),
    [activeSales]
  );
  const totalCostValue = useMemo(
    () => localProducts.reduce((sum, p) => {
      if (p.isService) return sum;
      return sum + (Number(p.costPrice || 0) * Math.max(0, Number(p.quantity || 0)));
    }, 0),
    [localProducts]
  );
  const avgSale = totalSalesCount ? Math.round(totalRevenue / totalSalesCount) : 0;
  const refundCount = scopedSales.filter((s) => s.status === 'REFUNDED').length;
  
  const netRevenue = totalRevenue - totalExpenses;

  // ── 7. Chart analytics ────────────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let financialData: { label: string; value: number; profit: number }[] = [];

    if (timeFilter === 'Daily') {
      const map: Record<string, { value: number; profit: number }> = {};
      const hours = Array.from({ length: 6 }, (_, i) => `${i * 4}:00 - ${(i + 1) * 4}:00`);
      const target = new Date(dailyDate);
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        if (d.getDate() === target.getDate() && d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear()) {
          const slot = Math.floor(d.getHours() / 4);
          const label = hours[slot];
          if (!map[label]) map[label] = { value: 0, profit: 0 };
          map[label].value += Number(s.total || 0);
          map[label].profit += Number(s.profit || 0);
        }
      });
      financialData = hours.map((l) => ({ label: l, value: map[l]?.value || 0, profit: map[l]?.profit || 0 }));
    } else if (timeFilter === 'Weekly') {
      // Show weeks-of-month (Week 1–4) for the current month, up to the current week only
      const map: Record<string, { value: number; profit: number }> = {};
      const allWeeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      // Current week index within the month (0-based)
      const currentWeekIndex = Math.min(Math.floor((now.getDate() - 1) / 7), 3);
      const weeksToShow = allWeeks.slice(0, currentWeekIndex + 1);
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        // Only include sales from the current month
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
        const weekIndex = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
        const label = allWeeks[weekIndex];
        if (!map[label]) map[label] = { value: 0, profit: 0 };
        map[label].value += Number(s.total || 0);
        map[label].profit += Number(s.profit || 0);
      });
      financialData = weeksToShow.map((l) => ({ label: l, value: map[l]?.value || 0, profit: map[l]?.profit || 0 }));
    } else if (timeFilter === 'Monthly') {
      // Show each month of the current year up to the current month only
      const map: Record<number, { value: number; profit: number }> = {};
      const currentMonthIndex = now.getMonth(); // 0-based
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        if (d.getFullYear() !== now.getFullYear()) return;
        const mIdx = d.getMonth();
        if (!map[mIdx]) map[mIdx] = { value: 0, profit: 0 };
        map[mIdx].value += Number(s.total || 0);
        map[mIdx].profit += Number(s.profit || 0);
      });
      // Only emit months from Jan up to (and including) the current month
      financialData = months
        .slice(0, currentMonthIndex + 1)
        .map((label, i) => ({ label, value: map[i]?.value || 0, profit: map[i]?.profit || 0 }));
    } else if (timeFilter === 'Quarterly') {
      const map: Record<number, { value: number; profit: number }> = {};
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const quarterMonths = [quarterStartMonth, quarterStartMonth + 1, quarterStartMonth + 2];
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        if (!map[d.getMonth()]) map[d.getMonth()] = { value: 0, profit: 0 };
        map[d.getMonth()].value += Number(s.total || 0);
        map[d.getMonth()].profit += Number(s.profit || 0);
      });
      financialData = quarterMonths.map((m) => ({ label: months[m], value: map[m]?.value || 0, profit: map[m]?.profit || 0 }));
    } else if (timeFilter === 'Annual') {
      const map: Record<number, { value: number; profit: number }> = {};
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        if (!map[d.getMonth()]) map[d.getMonth()] = { value: 0, profit: 0 };
        map[d.getMonth()].value += Number(s.total || 0);
        map[d.getMonth()].profit += Number(s.profit || 0);
      });
      financialData = months.map((label, i) => ({ label, value: map[i]?.value || 0, profit: map[i]?.profit || 0 }));
    } else { // All
      const map: Record<number, { value: number; profit: number }> = {};
      const years = Array.from(new Set(activeSales.map((s) => new Date(s.createdAt).getFullYear()))).sort();
      activeSales.forEach((s) => {
        const y = new Date(s.createdAt).getFullYear();
        if (!map[y]) map[y] = { value: 0, profit: 0 };
        map[y].value += Number(s.total || 0);
        map[y].profit += Number(s.profit || 0);
      });
      financialData = years.map((y) => ({ label: y.toString(), value: map[y]?.value || 0, profit: map[y]?.profit || 0 }));
      if (financialData.length === 0) financialData = [{ label: now.getFullYear().toString(), value: 0, profit: 0 }];
    }

    // Staff performance
    const staffMap: Record<string, number> = {};
    activeSales.forEach((s) => {
      const name = s.sellerName || 'System';
      staffMap[name] = (staffMap[name] || 0) + Number(s.total || 0);
    });
    const staff = Object.entries(staffMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Payment distribution
    const payMap: Record<string, number> = {};
    activeSales.forEach((s) => {
      const mode = s.paymentMode || 'CASH';
      payMap[mode] = (payMap[mode] || 0) + 1;
    });
    const payment = Object.entries(payMap).map(([label, value]) => ({ label, value }));

    return { financial: financialData, staff, payment };
  }, [activeSales, serverStats, timeFilter, dailyDate]);



  // ── 9. Print report ───────────────────────────────────────────────────────
  const handlePrint = () => {
    const data =
      activeTab === 'Financial'
        ? analyticsData.financial
        : activeTab === 'Staff'
        ? analyticsData.staff
        : analyticsData.payment;

    const companyName = localStorage.getItem('companyName') || 'MsikaPOS';
    const html = `
      <html>
        <head>
          <title>${companyName} — ${activeTab} Report</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 0 0 5px 0; }
            h2 { font-size: 12px; color: #666; text-transform: uppercase; margin: 0; letter-spacing: 2px; }
            .meta { font-size: 11px; color: #888; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 15px 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
            th { font-weight: 900; text-transform: uppercase; background: #f9f9f9; letter-spacing: 1px; color: #444; }
            .val { text-align: right; font-family: monospace; font-size: 14px; }
            th.val { text-align: right; font-family: 'Inter', sans-serif; font-size: 13px; }
            .total { font-weight: 900; font-size: 16px; margin-top: 30px; text-align: right; padding-top: 20px; border-top: 2px solid #111; }
            .footer { margin-top: 50px; font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <h2>Official ${activeTab} Report — ${timeFilter}</h2>
            <div class="meta">Generated: ${new Date().toLocaleString()} · Transactions: ${totalSalesCount} active, ${refundCount} refunded</div>
          </div>
          <table>
            <thead><tr><th>Metric / Category</th><th class="val">Value</th></tr></thead>
            <tbody>
              ${data.map((d) => `<tr><td>${d.label}</td><td class="val">${activeTab !== 'Payment' ? 'MK ' : ''}${d.value.toLocaleString()}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="total">
            Total: ${activeTab !== 'Payment' ? 'MK ' : ''}${data.reduce((s, d) => s + d.value, 0).toLocaleString()}
          </div>
          <div class="footer">
            Powered by MsikaPos &nbsp;·&nbsp; © ${new Date().getFullYear()} Indelible Technologies. All Rights Reserved.<br/>
            Generated on ${new Date().toLocaleString()}
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const stats = [
    { label: 'Available Revenue', value: `MK ${netRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', sub: `Gross: MK ${totalRevenue.toLocaleString()} - Exp: MK ${totalExpenses.toLocaleString()}` },
    { label: 'Gross Sales', value: `MK ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-primary-500', sub: `${totalSalesCount} transaction${totalSalesCount !== 1 ? 's' : ''}` },
    { label: 'Total Profit', value: `MK ${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: 'text-blue-500', sub: 'excl. refunds' },
    { label: 'Avg Sale', value: `MK ${avgSale.toLocaleString()}`, icon: Users, color: 'text-amber-500', sub: 'per transaction' },
    { label: 'Total Cost Value', value: `MK ${totalCostValue.toLocaleString()}`, icon: Package, color: 'text-rose-500', sub: 'active inventory value' },
  ];

  return (
    <div className="flex flex-col w-full transition-all px-0 relative">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-background border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-40">
        <div className="flex flex-row flex-nowrap items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/50 rounded-2xl shrink-0">
            {(['Financial', 'Staff', 'Payment'] as ReportTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-4 md:px-6 py-2 md:py-3 rounded-xl text-[9px] font-black tracking-widest transition-all whitespace-nowrap uppercase btn-press',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                {tab === 'Financial' ? 'Financial' : tab === 'Staff' ? 'Staff' : 'Payment'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">

            {/* Time filter (Financial only) */}
            {activeTab === 'Financial' && (
              <>
                {timeFilter === 'Daily' && (
                  <input
                    type="date"
                    value={dailyDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="px-3 py-2 bg-card/50 border border-border/50 rounded-xl text-[10px] font-black tracking-widest uppercase text-foreground outline-none cursor-pointer btn-press"
                  />
                )}
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                  title="Filter by time period"
                  aria-label="Filter by time period"
                  className="px-4 py-2 bg-card/50 border border-border/50 rounded-xl text-[10px] font-black tracking-widest uppercase text-primary outline-none cursor-pointer btn-press"
                >
                  <option value="All">All</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annual">Annual</option>
                </select>
              </>
            )}

            {/* Print */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold tracking-widest text-[10px] uppercase rounded-xl hover:bg-primary/90 transition-all btn-press shadow-lg shadow-primary/20"
            >
              Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12 pt-6">
        {/* ── Stats Grid ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 stagger-children">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card border border-border/50 p-5 rounded-3xl group hover:border-primary/30 transition-all shadow-sm shadow-primary/5"
            >
              <div className={`p-2.5 rounded-xl bg-muted/10 border border-border/50 w-fit mb-4 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-lg font-black tracking-tighter text-foreground">{stat.value}</div>
              <div className="text-[9px] font-black text-muted-foreground tracking-[0.15em] mt-1 uppercase">{stat.label}</div>
              <div className="text-[8px] text-muted-foreground/40 font-bold mt-0.5">{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Chart ────────────────────────────────────────────────────────── */}
        <div className="flex-1 mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + timeFilter}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'Financial' && (
                <BarChart
                  data={analyticsData.financial}
                  label={`${timeFilter} Revenue Breakdown`}
                  valuePrefix="MK "
                />
              )}
              {activeTab === 'Staff' && (
                <BarChart
                  data={analyticsData.staff}
                  label="Top Performing Cashiers"
                  valuePrefix="MK "
                />
              )}
              {activeTab === 'Payment' && (
                <BarChart data={analyticsData.payment} label="Payment Mode Flow" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Recent active transactions list ─────────────────────────────── */}
        <div className="bg-background border-y border-border/50 -mx-4 md:-mx-12 mb-8 overflow-hidden">
          <div className="px-4 md:px-12 py-4 bg-muted/5 border-b border-border/20">
            <h4 className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
              Recent Transactions — Live Feed
            </h4>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {activeSales.slice(0, 20).length === 0 ? (
              <p className="text-[10px] font-bold text-muted-foreground/30 text-center py-8 uppercase tracking-widest">
                No transactions for this period
              </p>
            ) : (
              activeSales.slice(0, 20).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center justify-between py-4 px-4 md:px-12 bg-transparent border-b border-border/10 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black font-mono">#{s.invoiceNo}</p>
                      <p className="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-widest">
                        {s.sellerName || 'System'} · {s.paymentMode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-emerald-500">
                      MK {Number(s.total || 0).toLocaleString()}
                    </p>
                    <p className="text-[8px] text-muted-foreground/40 font-bold">
                      {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
          {refundCount > 0 && (
            <p className="text-[8px] font-bold text-rose-400/60 mt-3 text-right uppercase tracking-widest">
              {refundCount} refunded transaction{refundCount !== 1 ? 's' : ''} excluded from totals
            </p>
          )}
        </div>

        {/* ── Market Intelligence ─────────────────────────────────────────── */}
        <div className="glass-panel border border-border/50 rounded-3xl p-8 mb-8">
          <h4 className="text-[10px] font-black tracking-widest text-muted-foreground/60 mb-4 uppercase">
            Market Intelligence
          </h4>
          <p className="text-sm font-black leading-relaxed text-muted-foreground tracking-tight">
            Revenue is primarily driven by{' '}
            <span className="text-primary">
              {analyticsData.payment[0]?.label || 'Cash'}
            </span>.{' '}
            {analyticsData.staff[0] && (
              <span>
                The top cashier is{' '}
                <span className="text-emerald-500 font-black">
                  {analyticsData.staff[0].label}
                </span>
                {' '}with MK {analyticsData.staff[0].value.toLocaleString()} in sales.{' '}
              </span>
            )}
            Data refreshes automatically every 30 seconds and reflects live deletions and refunds.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

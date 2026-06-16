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
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  startOfWeek, startOfMonth, startOfQuarter,
  startOfYear, endOfDay, isWithinInterval
} from 'date-fns';

type ReportTab = 'Financial' | 'Staff' | 'Payment';
type TimeFilter = 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';

// ─── Bar Chart ───────────────────────────────────────────────────────────────
const BarChart = ({
  data,
  label,
  valuePrefix = '',
}: {
  data: { label: string; value: number }[];
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
      <div className="h-64 flex items-end justify-between gap-2 pt-4">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 font-black text-xs tracking-widest uppercase">
            No data available
          </div>
        ) : (
          data.map((item, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="relative w-full flex flex-col justify-end h-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(item.value / maxVal) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                  className="w-full bg-primary/20 group-hover:bg-primary/40 border-t-4 border-primary rounded-t-lg transition-colors relative"
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 uppercase tracking-widest">
                    {valuePrefix}
                    {item.value.toLocaleString()}
                  </div>
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

const getScopeInterval = (timeFilter: TimeFilter) => {
  const now = new Date();
  const end = endOfDay(now);
  if (timeFilter === 'Weekly') return { start: startOfWeek(now), end };
  if (timeFilter === 'Monthly') return { start: startOfMonth(now), end };
  if (timeFilter === 'Quarterly') return { start: startOfQuarter(now), end };
  return { start: startOfYear(now), end };
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('Financial');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Weekly');

  // ── 1. Local live DB (instant on any change) ─────────────────────────────
  const localSales = useLiveQuery(() => db.salesQueue.toArray(), []) ?? [];

  // ── 2. Server transactions — polls every 30 s ─────────────────────────────
  const { data: serverSalesRaw } = useQuery({
    queryKey: ['reports-transactions', timeFilter],
    queryFn: async () => {
      const scopeMap: Record<TimeFilter, string> = {
        Weekly: 'weekly',
        Monthly: 'monthly',
        Quarterly: 'quarterly',
        Annual: 'annual',
      };
      const res = await api.get('/reports/transactions', {
        params: { scope: scopeMap[timeFilter] },
      });
      return (res.data.success ? res.data.data : []) as LocalSale[];
    },
    refetchInterval: 30_000,          // live-poll every 30 s
    refetchIntervalInBackground: true, // keep polling even if tab is not focused
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
    const interval = getScopeInterval(timeFilter);
    return allSales.filter((s) =>
      isWithinInterval(new Date(s.createdAt), interval)
    );
  }, [allSales, timeFilter]);

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
  const avgSale = totalSalesCount ? Math.round(totalRevenue / totalSalesCount) : 0;
  const refundCount = scopedSales.filter((s) => s.status === 'REFUNDED').length;

  // ── 7. Chart analytics ────────────────────────────────────────────────────
  const analyticsData = useMemo(() => {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    let financialData: { label: string; value: number }[] = [];

    if (timeFilter === 'Weekly') {
      if (serverStats?.chart_data?.length) {
        financialData = serverStats.chart_data.map((d: { name: string; revenue: number }) => ({
          label: d.name,
          value: d.revenue,
        }));
      } else {
        const map: Record<string, number> = {};
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { key: d.toLocaleDateString(), label: days[d.getDay()] };
        });
        activeSales.forEach((s) => {
          const d = new Date(s.createdAt);
          if (now.getTime() - d.getTime() <= 7 * 86_400_000) {
            const k = d.toLocaleDateString();
            map[k] = (map[k] || 0) + Number(s.total || 0);
          }
        });
        financialData = last7.map((d) => ({ label: d.label, value: map[d.key] || 0 }));
      }
    } else if (timeFilter === 'Monthly') {
      const map: Record<string, number> = {};
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      activeSales.forEach((s) => {
        const diff = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / 86_400_000);
        if (diff < 28) {
          const label = weeks[Math.max(0, 3 - Math.floor(diff / 7))];
          map[label] = (map[label] || 0) + Number(s.total || 0);
        }
      });
      financialData = weeks.map((l) => ({ label: l, value: map[l] || 0 }));
    } else if (timeFilter === 'Quarterly') {
      const map: Record<number, number> = {};
      const last3 = Array.from({ length: 3 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (2 - i));
        return { key: d.getMonth(), label: months[d.getMonth()] };
      });
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diff < 3) map[d.getMonth()] = (map[d.getMonth()] || 0) + Number(s.total || 0);
      });
      financialData = last3.map((m) => ({ label: m.label, value: map[m.key] || 0 }));
    } else {
      const map: Record<number, number> = {};
      const last12 = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return { key: d.getMonth(), label: months[d.getMonth()] };
      });
      activeSales.forEach((s) => {
        const d = new Date(s.createdAt);
        const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (diff < 12) map[d.getMonth()] = (map[d.getMonth()] || 0) + Number(s.total || 0);
      });
      financialData = last12.map((m) => ({ label: m.label, value: map[m.key] || 0 }));
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
  }, [activeSales, serverStats, timeFilter]);



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
          <div class="footer">Generated by MsikaPOS on ${new Date().toLocaleString()}</div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const stats = [
    { label: 'Revenue', value: `MK ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', sub: `${totalSalesCount} transaction${totalSalesCount !== 1 ? 's' : ''}` },
    { label: 'Transactions', value: totalSalesCount.toString(), icon: TrendingUp, color: 'text-primary-500', sub: `${refundCount} refunded` },
    { label: 'Total Profit', value: `MK ${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: 'text-blue-500', sub: 'excl. refunds' },
    { label: 'Avg Sale', value: `MK ${avgSale.toLocaleString()}`, icon: Users, color: 'text-amber-500', sub: 'per transaction' },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full bg-background transition-all pb-24 md:pb-0 px-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel border-b border-border/50 px-6 md:px-12 py-4 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/50 rounded-2xl overflow-x-auto no-scrollbar w-full md:w-auto">
            {(['Financial', 'Staff', 'Payment'] as ReportTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-6 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none uppercase btn-press',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                {tab === 'Financial' ? 'Financial' : tab === 'Staff' ? 'Staff' : 'Payment'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 ml-auto flex-wrap">

            {/* Time filter (Financial only) */}
            {activeTab === 'Financial' && (
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                title="Filter by time period"
                aria-label="Filter by time period"
                className="px-4 py-2 bg-card/50 border border-border/50 rounded-xl text-[10px] font-black tracking-widest uppercase text-primary outline-none cursor-pointer btn-press"
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
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
        <div className="glass-panel border border-border/50 rounded-3xl p-6 mb-8 overflow-hidden">
          <h4 className="text-[10px] font-black tracking-widest text-muted-foreground/60 mb-4 uppercase">
            Recent Transactions — Live Feed
          </h4>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {activeSales.slice(0, 20).length === 0 ? (
              <p className="text-[10px] font-bold text-muted-foreground/30 text-center py-8 uppercase tracking-widest">
                No transactions for this period
              </p>
            ) : (
              activeSales.slice(0, 20).map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between py-3 px-4 rounded-2xl bg-muted/5 border border-border/30 hover:border-primary/20 transition-all"
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

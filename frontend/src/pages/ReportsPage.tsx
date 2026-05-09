import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
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

type ReportTab = 'Financial' | 'Staff' | 'Payment';

// Helper for Bar Charts moved outside render
const BarChart = ({ data, label, valuePrefix = '' }: { data: { label: string, value: number }[], label: string, valuePrefix?: string }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="glass-panel border border-border/50 rounded-3xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black tracking-[0.2em] uppercase text-muted-foreground">{label}</h3>
        </div>
      </div>
      <div className="h-64 flex items-end justify-between gap-2 pt-4">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 font-black text-xs tracking-widest uppercase">No data available</div>
        ) : data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
            <div className="relative w-full flex flex-col justify-end h-full">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(item.value / maxVal) * 100}%` }}
                className="w-full bg-primary/20 group-hover:bg-primary/40 border-t-4 border-primary rounded-t-lg transition-all relative"
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 uppercase tracking-widest">
                  {valuePrefix}{item.value.toLocaleString()}
                </div>
              </motion.div>
            </div>
            <span className="text-[9px] font-black text-muted-foreground/60 truncate w-full text-center tracking-tighter uppercase">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ServerStats {
  today_sales: number;
  total_transactions: number;
  total_profit: number;
  active_products: number;
  low_stock: number;
  credit_reminders: number;
  recent_activity: Array<{
    invoice_no: string;
    total: number;
    username: string;
  }>;
  chart_data: Array<{
    name: string;
    revenue: number;
    customers: number;
  }>;
}

type TimeFilter = 'Weekly' | 'Monthly' | 'Quarterly' | 'Annual';

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('Financial');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Weekly');
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(false);
  
  const localSales = useLiveQuery(() => db.salesQueue.toArray());

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const res = await api.get('/dashboard/stats'); // Reusing dashboard stats for now as it has charts
        if (res.data.success) {
          setServerStats(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load report stats:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayLocalSales = (localSales || []).filter(s => s.createdAt.startsWith(today));
  
  const totalRevenue = serverStats?.today_sales || todayLocalSales.reduce((sum, s) => sum + s.total, 0);
  const totalSalesCount = serverStats?.total_transactions || localSales?.length || 0;
  const totalProfit = serverStats?.total_profit || localSales?.reduce((sum, s) => sum + (s.profit || 0), 0) || 0;

  // Process actual data for graphs
  const analyticsData = useMemo(() => {
    if (!localSales && !serverStats?.chart_data) {
      return { financial: [], staff: [], payment: [] };
    }

    let financialData: { label: string; value: number }[] = [];
    const salesToUse = localSales || [];
    const now = new Date();

    if (timeFilter === 'Weekly') {
      if (serverStats?.chart_data && serverStats.chart_data.length > 0) {
        financialData = serverStats.chart_data.map(d => ({
          label: d.name,
          value: d.revenue
        }));
      } else {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weeklyMap: Record<string, number> = {};
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { key: d.toLocaleDateString(), label: days[d.getDay()] };
        });
        salesToUse.forEach(s => {
          const d = new Date(s.createdAt);
          if ((now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
            weeklyMap[d.toLocaleDateString()] = (weeklyMap[d.toLocaleDateString()] || 0) + s.total;
          }
        });
        financialData = last7Days.map(d => ({ label: d.label, value: weeklyMap[d.key] || 0 }));
      }
    } else if (timeFilter === 'Monthly') {
      const monthlyMap: Record<string, number> = {};
      const last4Weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      salesToUse.forEach(s => {
        const d = new Date(s.createdAt);
        const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 28) {
          const weekIdx = 3 - Math.floor(daysDiff / 7);
          const label = last4Weeks[Math.max(0, weekIdx)];
          monthlyMap[label] = (monthlyMap[label] || 0) + s.total;
        }
      });
      financialData = last4Weeks.map(l => ({ label: l, value: monthlyMap[l] || 0 }));
    } else if (timeFilter === 'Quarterly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const qMap: Record<number, number> = {};
      const last3Months = Array.from({ length: 3 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (2 - i));
        return { key: d.getMonth(), label: months[d.getMonth()] };
      });
      salesToUse.forEach(s => {
        const d = new Date(s.createdAt);
        const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthsDiff < 3) {
          const m = d.getMonth();
          qMap[m] = (qMap[m] || 0) + s.total;
        }
      });
      financialData = last3Months.map(m => ({ label: m.label, value: qMap[m.key] || 0 }));
    } else if (timeFilter === 'Annual') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const aMap: Record<number, number> = {};
      const last12Months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (11 - i));
        return { key: d.getMonth(), label: months[d.getMonth()] };
      });
      salesToUse.forEach(s => {
        const d = new Date(s.createdAt);
        const monthsDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthsDiff < 12) {
          const m = d.getMonth();
          aMap[m] = (aMap[m] || 0) + s.total;
        }
      });
      financialData = last12Months.map(m => ({ label: m.label, value: aMap[m.key] || 0 }));
    }

    // 2. Staff Performance
    const staffMap: Record<string, number> = {};
    salesToUse.forEach(s => {
      const name = s.sellerName || 'System';
      staffMap[name] = (staffMap[name] || 0) + s.total;
    });
    const staff = Object.entries(staffMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);



    // 4. Payment Distribution (Customer Choice)
    const payMap: Record<string, number> = {};
    salesToUse.forEach(s => {
      const mode = s.paymentMode || 'CASH';
      payMap[mode] = (payMap[mode] || 0) + 1; // Count transactions as customer flow
    });
    const payment = Object.entries(payMap).map(([label, value]) => ({ label, value }));

    return { financial: financialData, staff, payment };
  }, [localSales, serverStats, timeFilter]);

  const stats = [
    { label: 'Revenue', value: `MK${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Transactions', value: totalSalesCount.toString(), icon: TrendingUp, color: 'text-primary-500' },
    { label: 'Total profit', value: `MK${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: 'text-blue-500' },
    { label: 'Avg sale', value: `MK${(totalSalesCount ? Math.round(totalRevenue / totalSalesCount) : 0).toLocaleString()}`, icon: Users, color: 'text-amber-500' },
  ];


  return (
    <div className="flex flex-col min-h-screen w-full bg-background transition-all pb-24 md:pb-0 px-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="glass-panel border-b border-border/50 px-6 md:px-12 py-6 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1"></div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex gap-2 p-1 bg-muted/20 border border-border/50 rounded-2xl overflow-x-auto no-scrollbar w-full md:w-auto">
            {(['Financial', 'Staff', 'Payment'] as ReportTab[]).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-6 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none uppercase btn-press",
                  activeTab === tab ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {tab === 'Financial' ? 'Financial reports' : 
                 tab === 'Staff' ? 'Staff reports' : 
                 'Payment reports'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
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

            <button 
              onClick={() => {
                const data = activeTab === 'Financial' ? analyticsData.financial : 
                             activeTab === 'Staff' ? analyticsData.staff : 
                             analyticsData.payment;
                
                const companyName = localStorage.getItem('companyName') || 'MsikaPOS';
                
                const html = `
                  <html>
                    <head>
                      <title>${companyName} - ${activeTab} Report</title>
                      <style>
                        body { font-family: 'Inter', sans-serif; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
                        .header { border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 30px; }
                        h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 0 0 5px 0; }
                        h2 { font-size: 12px; color: #666; text-transform: uppercase; margin: 0; letter-spacing: 2px; }
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
                        <h2>Official ${activeTab} Report &mdash; ${timeFilter}</h2>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Metric / Category</th>
                            <th class="val">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${data.map(d => `<tr><td>${d.label}</td><td class="val">${activeTab !== 'Payment' ? 'MK ' : ''}${d.value.toLocaleString()}</td></tr>`).join('')}
                        </tbody>
                      </table>
                      <div class="total">
                        Total Value: ${activeTab !== 'Payment' ? 'MK ' : ''}${data.reduce((s, d) => s + d.value, 0).toLocaleString()}
                      </div>
                      <div class="footer">Generated by MsikaPOS on ${new Date().toLocaleString()}</div>
                      <script>
                        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }
                      </script>
                    </body>
                  </html>
                `;
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(html);
                  win.document.close();
                }
              }}
              title="Print Professional Report"
              className="px-4 py-2 bg-primary text-primary-foreground font-bold tracking-widest text-[10px] uppercase rounded-xl hover:bg-primary/90 transition-all btn-press shadow-lg shadow-primary/20"
            >
              Print Report
            </button>

            {loading && (
              <div className="pr-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <span className="text-[8px] font-black tracking-widest text-primary uppercase">REFRESHING...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card border border-border/50 p-5 rounded-3xl group hover:border-primary/30 transition-all shadow-sm shadow-primary/5"
            >
              <div className={`p-2.5 rounded-xl bg-muted/10 border border-border/50 w-fit mb-4 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-lg font-black tracking-tighter text-foreground">{stat.value}</div>
              <div className="text-[9px] font-black text-muted-foreground tracking-[0.15em] mt-1 uppercase">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="flex-1 mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'Financial' && <BarChart data={analyticsData.financial} label={`${timeFilter} Revenue Breakdown`} valuePrefix="MK" />}
              {activeTab === 'Staff' && <BarChart data={analyticsData.staff} label="Top Performing Cashiers" valuePrefix="MK" />}
              {activeTab === 'Payment' && <BarChart data={analyticsData.payment} label="Payment Mode Flow" />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="glass-panel border border-border/50 rounded-3xl p-8 mb-8">
          <h4 className="text-[10px] font-black tracking-widest text-muted-foreground/60 mb-6 uppercase">Market Intelligence</h4>
          <p className="text-sm font-black leading-relaxed text-muted-foreground tracking-tight">
            Revenue is primarily driven by <span className="text-primary">{analyticsData.payment[0]?.label || 'Cash'}</span>. 
            {analyticsData.staff[0] && <span> The top cashier is <span className="text-success font-black">{analyticsData.staff[0].label}</span>. </span>}
            This data assists Super Admins in performance-based promotions and resource allocation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

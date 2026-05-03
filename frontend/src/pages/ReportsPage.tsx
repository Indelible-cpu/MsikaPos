import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import api from '../api/client';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  BarChart3,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

type ReportTab = 'Financial' | 'Staff' | 'Branches' | 'Payment';

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
    date: string;
    total: number;
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

  const totalRevenue = serverStats?.today_sales || 0;
  const totalSalesCount = serverStats?.total_transactions || 0;
  const totalProfit = serverStats?.total_profit || 0; // Might need to add this to backend

  // Process actual data for graphs
  const analyticsData = useMemo(() => {
    if (!localSales && !serverStats?.chart_data) {
      return { financial: [], staff: [], branches: [], payment: [] };
    }

    let financialData: { label: string; value: number }[] = [];
    const salesToUse = localSales || [];
    const now = new Date();

    if (timeFilter === 'Weekly') {
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

    // 3. Branch Performance (Super Admin View)
    const branchMap: Record<string, number> = {};
    salesToUse.forEach(s => {
      const branchName = s.branchId || 'Main HQ'; // Should ideally be name-resolved
      branchMap[branchName] = (branchMap[branchName] || 0) + s.total;
    });
    const branches = Object.entries(branchMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // 4. Payment Distribution (Customer Choice)
    const payMap: Record<string, number> = {};
    salesToUse.forEach(s => {
      const mode = s.paymentMode || 'CASH';
      payMap[mode] = (payMap[mode] || 0) + 1; // Count transactions as customer flow
    });
    const payment = Object.entries(payMap).map(([label, value]) => ({ label, value }));

    return { financial: financialData, staff, branches, payment };
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
            {(['Financial', 'Staff', 'Branches', 'Payment'] as ReportTab[]).map((tab) => (
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
                 tab === 'Branches' ? 'Branch reports' : 
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
              onClick={async () => {
                const { downloadCSV } = await import('../utils/exportUtils');
                const data = activeTab === 'Financial' ? analyticsData.financial : 
                             activeTab === 'Staff' ? analyticsData.staff : 
                             activeTab === 'Branches' ? analyticsData.branches : 
                             analyticsData.payment;
                
                downloadCSV(
                  ['Label', 'Value'],
                  data.map(d => [d.label, d.value]),
                  `MsikaPos_${activeTab}_Report_${new Date().toISOString().split('T')[0]}`
                );
              }}
              title="Export Report Data"
              className="p-2.5 bg-card/50 border border-border/50 rounded-xl text-primary hover:bg-primary/10 transition-all btn-press"
            >
              <Download className="w-4 h-4" />
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
              {activeTab === 'Branches' && <BarChart data={analyticsData.branches} label="Top Performing Branches" valuePrefix="MK" />}
              {activeTab === 'Payment' && <BarChart data={analyticsData.payment} label="Payment Mode Flow" />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="glass-panel border border-border/50 rounded-3xl p-8 mb-8">
          <h4 className="text-[10px] font-black tracking-widest text-muted-foreground/60 mb-6 uppercase">Market Intelligence</h4>
          <p className="text-sm font-black leading-relaxed text-muted-foreground tracking-tight">
            Revenue is primarily driven by <span className="text-primary">{analyticsData.payment[0]?.label || 'Cash'}</span>. 
            {analyticsData.staff[0] && <span> The top cashier is <span className="text-success font-black">{analyticsData.staff[0].label}</span>. </span>}
            {analyticsData.branches[0] && <span> The leading location is <span className="text-amber-500 font-black">{analyticsData.branches[0].label}</span>. </span>}
            This data assists Super Admins in performance-based promotions and multi-branch resource allocation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

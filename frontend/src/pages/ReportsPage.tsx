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

type ReportTab = 'Financial' | 'Staff' | 'Branches' | 'Payment';

// Helper for Bar Charts moved outside render
const BarChart = ({ data, label, valuePrefix = '' }: { data: { label: string, value: number }[], label: string, valuePrefix?: string }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bg-surface-card border border-surface-border rounded-3xl p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black tracking-wider">{label}</h3>
        </div>
      </div>
      <div className="h-64 flex items-end justify-between gap-2 pt-4">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-surface-text/10 font-black text-xs tracking-widest">No data available</div>
        ) : data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
            <div className="relative w-full flex flex-col justify-end h-full">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${(item.value / maxVal) * 100}%` }}
                className="w-full bg-primary-500/20 group-hover:bg-primary-500/40 border-t-4 border-primary-500 rounded-t-lg transition-all relative"
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-text text-surface-bg text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {valuePrefix}{item.value.toLocaleString()}
                </div>
              </motion.div>
            </div>
            <span className="text-[9px] font-bold text-surface-text/30 truncate w-full text-center tracking-tighter">{item.label}</span>
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

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('Financial');
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
    if (serverStats?.chart_data) {
      return {
        weekly: serverStats.chart_data.map(d => ({ label: d.date, value: d.total })),
        staff: serverStats.recent_activity ? Object.entries(serverStats.recent_activity.reduce((acc: Record<string, number>, curr) => {
          acc[curr.username] = (acc[curr.username] || 0) + curr.total;
          return acc;
        }, {})).map(([label, value]) => ({ label, value })) : [],
        branches: [], // Branch data could be added to backend
        payment: [] 
      };
    }

    if (!localSales) return { weekly: [], staff: [], branches: [], payment: [] };

    // 1. Weekly Revenue (Last 7 Days)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { key: d.toLocaleDateString(), label: days[d.getDay()] };
    });

    localSales.forEach(s => {
      const date = new Date(s.createdAt).toLocaleDateString();
      weeklyMap[date] = (weeklyMap[date] || 0) + s.total;
    });

    const weekly = last7Days.map(d => ({ label: d.label, value: weeklyMap[d.key] || 0 }));

    // 2. Staff Performance
    const staffMap: Record<string, number> = {};
    localSales.forEach(s => {
      const name = s.sellerName || 'System';
      staffMap[name] = (staffMap[name] || 0) + s.total;
    });
    const staff = Object.entries(staffMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 3. Branch Performance (Super Admin View)
    const branchMap: Record<string, number> = {};
    localSales.forEach(s => {
      const branchName = s.branchId || 'Main HQ'; // Should ideally be name-resolved
      branchMap[branchName] = (branchMap[branchName] || 0) + s.total;
    });
    const branches = Object.entries(branchMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // 4. Payment Distribution (Customer Choice)
    const payMap: Record<string, number> = {};
    localSales.forEach(s => {
      const mode = s.paymentMode || 'CASH';
      payMap[mode] = (payMap[mode] || 0) + 1; // Count transactions as customer flow
    });
    const payment = Object.entries(payMap).map(([label, value]) => ({ label, value }));

    return { weekly, staff, branches, payment };
  }, [localSales, serverStats]);

  const stats = [
    { label: 'Revenue', value: `MK${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Transactions', value: totalSalesCount.toString(), icon: TrendingUp, color: 'text-primary-500' },
    { label: 'Total Profit', value: `MK${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: 'text-blue-500' },
    { label: 'Avg Sale', value: `MK${(totalSalesCount ? Math.round(totalRevenue / totalSalesCount) : 0).toLocaleString()}`, icon: Users, color: 'text-amber-500' },
  ];


  return (
    <div className="flex flex-col min-h-screen w-full bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <header className="bg-surface-card border-b border-surface-border px-6 md:px-12 py-6 mb-8 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex gap-2 p-1 bg-surface-bg border border-surface-border rounded-2xl overflow-x-auto no-scrollbar">
          {(['Financial', 'Staff', 'Branches', 'Payment'] as ReportTab[]).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                "px-6 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all whitespace-nowrap",
                activeTab === tab ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-surface-text/40 hover:bg-surface-bg/50"
              )}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
        {loading && (
          <div className="pr-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
            <span className="text-[8px] font-black tracking-widest text-primary-500">REFRESHING...</span>
          </div>
        )}
      </header>

      <div className="px-6 md:px-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface-card border border-surface-border p-5 rounded-3xl group hover:border-primary-500/30 transition-all shadow-sm shadow-primary-500/5"
            >
              <div className={`p-2.5 rounded-xl bg-surface-bg border border-surface-border w-fit mb-4 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-lg font-black tracking-tighter">{stat.value}</div>
              <div className="text-[9px] font-black text-surface-text/30 tracking-[0.15em] mt-1 uppercase">{stat.label}</div>
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
              {activeTab === 'Financial' && <BarChart data={analyticsData.weekly} label="Weekly Revenue Breakdown" valuePrefix="MK" />}
              {activeTab === 'Staff' && <BarChart data={analyticsData.staff} label="Top Performing Cashiers" valuePrefix="MK" />}
              {activeTab === 'Branches' && <BarChart data={analyticsData.branches} label="Top Performing Branches" valuePrefix="MK" />}
              {activeTab === 'Payment' && <BarChart data={analyticsData.payment} label="Payment Mode Flow" />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-3xl p-6">
          <h4 className="text-[10px] font-black tracking-widest text-surface-text/30 mb-4 uppercase">Market Intelligence</h4>
          <p className="text-xs font-bold leading-relaxed text-surface-text/60">
            Revenue is primarily driven by <span className="text-primary-500">{analyticsData.payment[0]?.label || 'Cash'}</span>. 
            {analyticsData.staff[0] && <span> The top cashier is <span className="text-emerald-500 font-black">{analyticsData.staff[0].label}</span>. </span>}
            {analyticsData.branches[0] && <span> The leading location is <span className="text-amber-500 font-black">{analyticsData.branches[0].label}</span>. </span>}
            This data assists Super Admins in performance-based promotions and multi-branch resource allocation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

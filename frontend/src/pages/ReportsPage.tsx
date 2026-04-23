import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowUpRight, 
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

type ReportTab = 'FINANCIAL' | 'STAFF' | 'CUSTOMER';

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('FINANCIAL');
  
  const sales = useLiveQuery(() => db.salesQueue.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());

  const totalRevenue = sales?.reduce((sum, s) => sum + s.total, 0) || 0;
  const totalSalesCount = sales?.length || 0;
  const totalProfit = sales?.reduce((sum, s) => {
    const saleProfit = s.items?.reduce((pSum, item) => pSum + (item.profit || 0), 0) || 0;
    return sum + saleProfit;
  }, 0) || 0;

  const stats = [
    { label: 'Revenue', value: `MK ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Transactions', value: totalSalesCount.toString(), icon: TrendingUp, color: 'text-primary-500' },
    { label: 'Total Profit', value: `MK ${totalProfit.toLocaleString()}`, icon: ArrowUpRight, color: 'text-blue-500' },
    { label: 'Customers', value: (customers?.length || 0).toString(), icon: Users, color: 'text-amber-500' },
  ];

  // Helper for Bar Charts
  const BarChart = ({ data, label, valuePrefix = '' }: { data: { label: string, value: number }[], label: string, valuePrefix?: string }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="bg-surface-card border border-surface-border rounded-3xl p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider">{label}</h3>
          </div>
        </div>
        <div className="h-64 flex items-end justify-between gap-2 pt-4">
          {data.map((item, i) => (
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
              <span className="text-[9px] font-bold text-surface-text/30 uppercase truncate w-full text-center">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFinancial = () => {
    const weeklyData = [
      { label: 'Mon', value: 45000 },
      { label: 'Tue', value: 52000 },
      { label: 'Wed', value: 38000 },
      { label: 'Thu', value: 65000 },
      { label: 'Fri', value: 48000 },
      { label: 'Sat', value: 72000 },
      { label: 'Sun', value: 41000 },
    ];
    return <BarChart data={weeklyData} label="Weekly Revenue" valuePrefix="MK " />;
  };

  const renderStaff = () => {
    const staffData = [
      { label: 'James', value: 120000 },
      { label: 'Aubrey', value: 95000 },
      { label: 'Mary', value: 88000 },
      { label: 'Steve', value: 45000 },
      { label: 'Admin', value: 30000 },
    ];
    return <BarChart data={staffData} label="Sales by Staff (Current Month)" valuePrefix="MK " />;
  };

  const renderCustomer = () => {
    const customerData = [
      { label: 'Premium', value: 45 },
      { label: 'Regular', value: 82 },
      { label: 'New', value: 24 },
      { label: 'Inactive', value: 12 },
    ];
    return <BarChart data={customerData} label="Customer Distribution" />;
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-4 md:px-8 pt-6">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight italic uppercase">Business Analytics</h1>
            <p className="text-[10px] text-surface-text/40 font-black uppercase tracking-widest mt-1">Real-time performance metrics</p>
          </div>
          
          <div className="flex gap-2 p-1 bg-surface-card border border-surface-border rounded-2xl overflow-x-auto no-scrollbar">
            {(['FINANCIAL', 'STAFF', 'CUSTOMER'] as ReportTab[]).map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-surface-text/40 hover:bg-surface-bg"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

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
            <div className="text-[9px] font-black text-surface-text/30 uppercase tracking-[0.15em] mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'FINANCIAL' && renderFinancial()}
            {activeTab === 'STAFF' && renderStaff()}
            {activeTab === 'CUSTOMER' && renderCustomer()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 bg-surface-card border border-surface-border rounded-3xl p-6">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-surface-text/30 mb-4">Market Insight</h4>
        <p className="text-xs font-bold leading-relaxed text-surface-text/60">
          Your business is showing consistent growth. Most active branch is <span className="text-primary-500">Domasi Main</span> with a <span className="text-emerald-500 font-black">+15%</span> increase in weekend transactions. 
          Recommendation: Increase inventory for 'Electronics' category before the month end.
        </p>
      </div>
    </div>
  );
};

export default ReportsPage;

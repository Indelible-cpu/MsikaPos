import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

const ReportsPage: React.FC = () => {
  const sales = useLiveQuery(() => db.salesQueue.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const products = useLiveQuery(() => db.products.toArray());

  const totalRevenue = sales?.reduce((sum, s) => sum + s.total, 0) || 0;
  const totalSales = sales?.length || 0;
  const totalProfit = sales?.reduce((sum, s) => {
    const saleProfit = s.items?.reduce((pSum, item) => pSum + (item.profit || 0), 0) || 0;
    return sum + saleProfit;
  }, 0) || 0;

  const stats = [
    { label: 'Revenue', value: `MK ${totalRevenue.toLocaleString()}`, icon: DollarSign, trend: '+12.5%', color: 'text-emerald-500' },
    { label: 'Total Sales', value: totalSales.toString(), icon: TrendingUp, trend: '+5.2%', color: 'text-primary-500' },
    { label: 'Gross Profit', value: `MK ${totalProfit.toLocaleString()}`, icon: ArrowUpRight, trend: '+8.1%', color: 'text-blue-500' },
    { label: 'Active Customers', value: (customers?.length || 0).toString(), icon: Users, trend: '+2', color: 'text-amber-500' },
  ];

  // Dummy data for visual representation
  const weeklyData = [
    { day: 'Mon', value: 45000 },
    { day: 'Tue', value: 52000 },
    { day: 'Wed', value: 38000 },
    { day: 'Thu', value: 65000 },
    { day: 'Fri', value: 48000 },
    { day: 'Sat', value: 72000 },
    { day: 'Sun', value: 41000 },
  ];

  const maxVal = Math.max(...weeklyData.map(d => d.value));

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-4 md:px-8 pt-6">
      <header className="mb-8 hidden md:block">
        <h1 className="text-2xl font-black tracking-tight">Performance Reports</h1>
        <p className="text-xs text-surface-text/40 font-bold mt-1">Detailed analysis of your business health</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-surface-card border border-surface-border p-4 rounded-3xl group hover:border-primary-500/30 transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`p-2 rounded-xl bg-surface-bg border border-surface-border ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-emerald-500">{stat.trend}</span>
            </div>
            <div className="text-lg font-black tracking-tight">{stat.value}</div>
            <div className="text-[10px] font-bold text-surface-text/30 uppercase tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Performance (Bar Chart) */}
        <div className="bg-surface-card border border-surface-border rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-500/10 text-primary-500 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider">Weekly Revenue</h3>
            </div>
            <button className="p-2 bg-surface-bg rounded-lg border border-surface-border hover:bg-surface-card transition-all">
              <Calendar className="w-4 h-4 text-surface-text/40" />
            </button>
          </div>
          
          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {weeklyData.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="relative w-full flex flex-col justify-end h-full">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${(data.value / maxVal) * 100}%` }}
                    className="w-full bg-primary-500/20 group-hover:bg-primary-500/40 border-t-4 border-primary-500 rounded-t-lg transition-all relative"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-text text-surface-bg text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      MK {data.value.toLocaleString()}
                    </div>
                  </motion.div>
                </div>
                <span className="text-[10px] font-bold text-surface-text/30">{data.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Mix (Pie Chart Simulation) */}
        <div className="bg-surface-card border border-surface-border rounded-3xl p-6">
           <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <PieIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider">Category Mix</h3>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around h-64">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="16" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-surface-bg" />
                <circle cx="18" cy="18" r="16" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="60 100" className="text-primary-500" />
                <circle cx="18" cy="18" r="16" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="30 100" strokeDashoffset="-60" className="text-amber-500" />
                <circle cx="18" cy="18" r="16" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray="10 100" strokeDashoffset="-90" className="text-emerald-500" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-surface-text/30">Total</span>
                <span className="text-lg font-black">100%</span>
              </div>
            </div>
            
            <div className="space-y-3 mt-6 md:mt-0">
              {[
                { label: 'General', color: 'bg-primary-500', value: '60%' },
                { label: 'Food & Bev', color: 'bg-amber-500', value: '30%' },
                { label: 'Electronics', color: 'bg-emerald-500', value: '10%' },
              ].map((cat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <span className="text-xs font-bold text-surface-text/60 min-w-[80px]">{cat.label}</span>
                  <span className="text-xs font-black">{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card border border-surface-border rounded-3xl p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
            <LineIcon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider">Staff Performance</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="pb-4 text-[10px] font-black text-surface-text/30 uppercase tracking-widest">Employee</th>
                <th className="pb-4 text-[10px] font-black text-surface-text/30 uppercase tracking-widest">Transactions</th>
                <th className="pb-4 text-[10px] font-black text-surface-text/30 uppercase tracking-widest">Total Sales</th>
                <th className="pb-4 text-[10px] font-black text-surface-text/30 uppercase tracking-widest text-right">Avg Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {[
                { name: 'James P Dickson', count: 450, sales: 'MK 2.4M', avg: 'MK 5.3K' },
                { name: 'Aubrey Dickson', count: 380, sales: 'MK 1.9M', avg: 'MK 5.0K' },
                { name: 'System Admin', count: 120, sales: 'MK 0.8M', avg: 'MK 6.6K' },
              ].map((staff, i) => (
                <tr key={i} className="group hover:bg-primary-500/5 transition-colors">
                  <td className="py-4 font-bold text-xs">{staff.name}</td>
                  <td className="py-4 text-xs font-black">{staff.count}</td>
                  <td className="py-4 text-xs font-black text-primary-500">{staff.sales}</td>
                  <td className="py-4 text-xs font-black text-right">{staff.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardPage: React.FC = () => {
  const sales = useLiveQuery(() => db.salesQueue.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const products = useLiveQuery(() => db.products.toArray());

  const totalRevenue = sales?.reduce((sum, s) => sum + s.total, 0) || 0;
  const totalOrders = sales?.length || 0;
  const totalCustomers = customers?.length || 0;
  const lowStockCount = products?.filter(p => p.quantity <= 5).length || 0;

  const stats = [
    { label: 'Total Revenue', value: `MK ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', trend: '+12.5%' },
    { label: 'Total Orders', value: totalOrders.toString(), icon: Activity, color: 'text-primary-400', trend: '+5.2%' },
    { label: 'Customers', value: totalCustomers.toString(), icon: Users, color: 'text-amber-500', trend: '+2' },
    { label: 'Low Stock Items', value: lowStockCount.toString(), icon: Package, color: 'text-red-500', trend: '-1' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <div className="p-0 md:p-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface-card border border-surface-border p-6 rounded-3xl group hover:border-primary-500/30 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-surface-bg border border-surface-border group-hover:border-primary-500/20 transition-colors ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stat.trend}
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight mb-1">{stat.value}</div>
              <div className="text-[10px] font-bold text-surface-text/30">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts/Tables Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-surface-card border border-surface-border rounded-3xl p-8">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-sm font-black">Recent sales</h3>
                 <button className="text-[10px] font-black text-primary-400 hover:underline">View all</button>
              </div>
              <div className="space-y-4">
                 {sales?.slice(-5).reverse().map((sale, i) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-surface-bg/50 rounded-2xl border border-surface-border">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{sale.invoiceNo}</div>
                            <div className="text-[9px] text-surface-text/30 font-bold">{new Date(sale.createdAt).toLocaleDateString()}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black">MK {sale.total.toLocaleString()}</div>
                         <div className="text-[8px] text-surface-text/20 font-bold">{sale.paymentMode}</div>
                      </div>
                   </div>
                 ))}
                 {(!sales || sales.length === 0) && (
                    <div className="p-10 text-center text-surface-text/20 font-bold text-xs">No recent activity</div>
                 )}
              </div>
           </div>

           <div className="bg-surface-card border border-surface-border rounded-3xl p-8">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-sm font-black">Low stock alert</h3>
                 <button className="text-[10px] font-black text-primary-400 hover:underline">Manage inventory</button>
              </div>
              <div className="space-y-4">
                 {products?.filter(p => p.quantity <= 5).slice(0, 5).map((p, i) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{p.name}</div>
                            <div className="text-[9px] text-surface-text/30 font-bold">SKU: {p.sku}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black text-red-500">{p.quantity}</div>
                         <div className="text-[8px] text-surface-text/20 font-black">Left in stock</div>
                      </div>
                   </div>
                 ))}
                 {lowStockCount === 0 && (
                    <div className="p-10 text-center text-emerald-500/20 font-bold text-xs">All stock levels healthy</div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

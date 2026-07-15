import React, { useEffect, useMemo } from 'react';
import { 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight,
  Wallet,
  Receipt,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom'; 
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
// date-fns removed
import api from '../api/client';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface ServerStats {
  today_sales: number;
  today_expenses: number;
  total_sales: number;
  total_credit_balance: number;
  credit_customer_count: number;
  low_stock: number;
  chart_data: { name: string; revenue: number; customers: number }[];
  recent_activity: { invoice_no: string; total: number; username: string; createdAt: string }[];
}

interface Product {
  isService: boolean;
  quantity: number;
  name: string;
  sku: string;
}

interface Credit {
  status: string;
  current_total: number;
  paid_amount: number;
  customer_name: string;
  customer_phone: string;
}

const DashboardPage: React.FC = () => {
  const { canAccess } = useFeatureAccess();
  // ── Server stats (single source of truth for all financial numbers) ──────
  const { data: serverStats, isLoading: serverLoading, refetch } = useQuery<ServerStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    staleTime: 30_000,       // wait at least 30s before refetching on focus
    refetchInterval: 60_000, // auto-refresh every minute
    refetchOnWindowFocus: true,
  });

  // Immediately refetch dashboard whenever a background sync completes
  useEffect(() => {
    const onSyncDone = () => refetch();
    window.addEventListener('sync:completed', onSyncDone);
    return () => window.removeEventListener('sync:completed', onSyncDone);
  }, [refetch]);

  // ── Local DB — only for lists that are display-only (expenses, low-stock) ─
  const localExpenses = useLiveQuery(() => db.expenses.orderBy('createdAt').reverse().limit(5).toArray());
  const localProducts = useLiveQuery(() =>
    db.products.where('status').equals('Active').filter(p => !p.deleted).toArray()
  );
  const localCustomers = useLiveQuery(() => db.customers.where('balance').above(0).limit(10).toArray());

  const lowStockItems = (localProducts || []).filter(p => !p.isService && p.quantity <= 5);
  const activeCredits = (localCustomers || [])
    .filter(c => Number(c.balance || 0) > 0)
    .map(c => ({
      status: 'Pending',
      current_total: Number(c.totalCreditAmount || 0),
      paid_amount: Number(c.totalPaidAmount || 0),
      customer_name: c.name,
      customer_phone: c.phone
    }));

  // ── Derived values — always from server, never from stale local cache ─────
  const totalRevenueToday  = serverStats?.today_sales    ?? 0;
  const totalExpensesToday = serverStats?.today_expenses ?? 0;
  const totalCreditAmount  = serverStats?.total_credit_balance ?? 0;
  const chartData          = serverStats?.chart_data     ?? [];

  const statCards = useMemo(() => [
    { label: "Today's sales",    value: `MK ${totalRevenueToday.toLocaleString()}`,  icon: DollarSign, color: 'text-emerald-500', trend: '+Today' },
    { label: "Today's expenses", value: `MK ${totalExpensesToday.toLocaleString()}`, icon: Wallet,     color: 'text-rose-500',    trend: 'Daily outflow' },
    { label: 'Active credits',   value: `MK ${totalCreditAmount.toLocaleString()}`,  icon: Users,      color: 'text-amber-500',   trend: `${serverStats?.credit_customer_count ?? activeCredits.length} Customers` },
  ], [totalRevenueToday, totalExpensesToday, totalCreditAmount, serverStats?.credit_customer_count, activeCredits.length]);

  const expenses = localExpenses || [];

  return (
    <div className="flex flex-col transition-all px-0">
      <div className="px-0 py-0 md:px-0 md:py-0">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 stagger-children">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-8 transition-all duration-500 border-b md:border-b-0 md:border-r border-border/50 hover:bg-muted/5 group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-muted/10 border border-border/50 group-hover:border-primary/20 transition-colors ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${stat.trend.includes('outflow') || stat.trend.includes('Customers') ? 'bg-primary/10 text-primary' : stat.trend.startsWith('+') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {stat.trend.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>
              {serverLoading ? (
                <div className="h-9 w-3/4 rounded-xl bg-muted/20 animate-pulse mb-1" />
              ) : (
                <div className="text-3xl font-black tracking-tighter mb-1 text-foreground">{stat.value}</div>
              )}
              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>


        {/* Charts Section */}
        {(canAccess('REPORTS') || canAccess('FINANCE')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 stagger-children border-b border-border/50">
           {/* Revenue & Customer Flow Chart */}
           <div className="lg:col-span-2 p-6 md:p-12 relative overflow-hidden md:border-r border-border/50 glass-panel">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                 <div>
                    <h3 className="text-base font-black tracking-tighter text-primary uppercase">Business Analytics</h3>
                    <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Revenue vs Customer Flow (Last 7 Days)</div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-primary-500" />
                       <span className="text-[9px] font-black text-surface-text/40">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-amber-500" />
                       <span className="text-[9px] font-black text-surface-text/40">Flow</span>
                    </div>
                 </div>
              </div>

              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)', fontWeight: 900 }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#111', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        fontSize: '10px',
                        fontWeight: '900'
                      }}
                    />
                    <Line 
                      type="linear" 
                      dataKey="revenue" 
                      stroke="var(--color-primary-500)" 
                      strokeWidth={4}
                      dot={{ r: 4, fill: "var(--color-primary-500)", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="linear" 
                      dataKey="customers" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Daily Flow Breakdown */}
           <div className="p-6 md:p-12 glass-panel">
              <div className="mb-10">
                 <h3 className="text-base font-black tracking-tighter text-amber-500 uppercase">Peak Flow</h3>
                 <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Transactions per day</div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <Bar dataKey="customers" radius={[10, 10, 0, 0]}>
                      {chartData.map((_: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'var(--color-primary-500)' : 'rgba(255,255,255,0.1)'} />
                      ))}
                    </Bar>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.2)', fontWeight: 900 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ 
                        backgroundColor: '#111', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        fontSize: '10px',
                        fontWeight: '900'
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
        )}

        {/* Expenses & Low Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-border/50 stagger-children">
           {canAccess('FINANCE') ? (
           <div className="p-6 md:p-12 md:border-r border-border/50 glass-panel">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-sm font-black text-muted-foreground uppercase">Recent Expenses</h3>
                 <div className="flex gap-4 items-center">
                    <Link to="/staff/expenses" className="text-[10px] font-black text-primary hover:underline uppercase btn-press">MANAGE ALL</Link>
                    <Link to="/staff/expenses" className="p-2 bg-primary text-primary-foreground rounded-lg active:scale-95 transition-all shadow-lg shadow-primary/20 btn-press" title="Add Expense">
                       <Plus className="w-3 h-3" />
                    </Link>
                 </div>
              </div>
              <div className="space-y-4">
                 {expenses.map((expense, i) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-muted/5 border-b border-border/50 group hover:bg-muted/10 transition-all rounded-xl">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center">
                            <Receipt className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{expense.description}</div>
                            <div className="text-[9px] font-black uppercase text-muted-foreground">{expense.category}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black text-destructive">- MK {expense.amount.toLocaleString()}</div>
                      </div>
                   </div>
                 ))}
                 {expenses.length === 0 && (
                    <div className="p-10 text-center text-muted-foreground/20 font-bold text-xs tracking-widest uppercase">No expenses recorded</div>
                 )}
              </div>
           </div>
           ) : <div className="hidden lg:block md:border-r border-border/50" />}

           {canAccess('INVENTORY') ? (
           <div className="p-6 md:p-12 glass-panel">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-sm font-black text-muted-foreground uppercase">Low Stock Alert</h3>
                 <Link to="/staff/inventory" className="text-[10px] font-black text-primary hover:underline uppercase btn-press">Manage inventory</Link>
              </div>
              <div className="space-y-4">
                 {lowStockItems.slice(0, 5).map((p: Product, i: number) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-muted/5 border-b border-border/50 transition-all rounded-xl hover:bg-muted/10">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{p.name}</div>
                            <div className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase">SKU: {p.sku}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black text-destructive">{p.quantity}</div>
                         <div className="text-[8px] text-muted-foreground/60 font-black uppercase">Left in stock</div>
                      </div>
                   </div>
                 ))}
                 {lowStockItems.length === 0 && (
                    <div className="p-10 text-center text-success/20 font-bold text-xs tracking-widest uppercase">All stock levels healthy</div>
                 )}
              </div>
           </div>
           ) : <div className="hidden lg:block glass-panel" />}
        </div>

        {/* Credit Customers */}
        {canAccess('CUSTOMERS') && (
        <div className="p-6 md:p-12 border-t border-border/50 glass-panel">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-sm font-black text-muted-foreground uppercase">Active Credits</h3>
              <Link to="/staff/debt" className="text-[10px] font-black text-primary hover:underline uppercase btn-press">Manage all</Link>
           </div>
           <div className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 stagger-children">
              {activeCredits?.slice(0, 6).map((customer: Credit, i: number) => (
                <div key={i} className="flex justify-between items-center p-4 bg-muted/5 border-b border-border/50 group hover:bg-muted/10 transition-all rounded-xl m-2">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                         <Users className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="text-xs font-black">{customer.customer_name}</div>
                         <div className="text-[9px] font-black uppercase text-muted-foreground">{customer.customer_phone}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-sm font-black text-destructive">MK {(customer.current_total - customer.paid_amount).toLocaleString()}</div>
                   </div>
                </div>
              ))}
              {(!activeCredits || activeCredits.length === 0) && (
                 <div className="col-span-full p-10 text-center text-muted-foreground/20 font-bold text-xs tracking-widest uppercase">No active credits</div>
              )}
           </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

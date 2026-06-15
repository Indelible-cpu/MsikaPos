import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign, 
  ArrowUpRight,
  Wallet,
  Receipt,
  Plus,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

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

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';

const DashboardPage: React.FC = () => {
  const localSales = useLiveQuery(() => db.salesQueue.toArray());
  const localExpenses = useLiveQuery(() => db.expenses.toArray());
  const localProducts = useLiveQuery(() => db.products.filter(p => !p.deleted && (!p.status || p.status.toLowerCase() === 'active')).toArray());
  const localCustomers = useLiveQuery(() => db.customers.toArray());

  const today = new Date().toISOString().split('T')[0];
  
  const todaySales = (localSales || []).filter(s => s.createdAt.startsWith(today));
  const todayExpensesArr = (localExpenses || []).filter(e => e.date?.startsWith(today) || e.createdAt?.startsWith(today));
  
  const totalRevenueToday = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalProfitToday = todaySales.reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const totalExpensesToday = todayExpensesArr.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalSalesAllTime = (localSales || []).reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalProfitAllTime = (localSales || []).reduce((sum, s) => sum + Number(s.profit || 0), 0);
  const totalCostAllTime = (localProducts || []).reduce((sum, p) => sum + (Number(p.costPrice || 0) * Number(p.quantity || 0)), 0);

  const activeCredits = (localCustomers || []).filter(c => Number(c.balance || 0) > 0).map(c => ({
    status: 'Pending',
    current_total: Number(c.totalCreditAmount || 0),
    paid_amount: Number(c.totalPaidAmount || 0),
    customer_name: c.name,
    customer_phone: c.phone
  }));
  const totalCreditAmount = (localCustomers || []).reduce((sum, c) => sum + Number(c.balance || 0), 0);
  const lowStockItems = (localProducts || []).filter(p => !p.isService && p.quantity <= 5);
  const expenses = localExpenses || [];

  const chartData = React.useMemo(() => {
    if (!localSales) return [];
    const days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const salesOnDate = localSales.filter(s => s.createdAt.startsWith(dateStr));
      days.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: salesOnDate.reduce((sum, s) => sum + Number(s.total || 0), 0),
        customers: salesOnDate.length
      });
    }
    return days;
  }, [localSales]);

  const stats = {
    today_sales: totalRevenueToday,
    today_profit: totalProfitToday,
    today_expenses: totalExpensesToday,
    total_sales: totalSalesAllTime,
    total_cost: totalCostAllTime,
    total_profit: totalProfitAllTime,
    active_products: localProducts?.length || 0,
    low_stock: lowStockItems.length,
    chart_data: chartData
  };

  const statCards = [
    { label: "Today's sales", value: `MK ${totalRevenueToday.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', trend: '+Today' },
    { label: "Today's profit", value: `MK ${totalProfitToday.toLocaleString()}`, icon: TrendingUp, color: 'text-primary-400', trend: 'Net margin' },
    { label: "Today's expenses", value: `MK ${totalExpensesToday.toLocaleString()}`, icon: Wallet, color: 'text-rose-500', trend: 'Daily outflow' },
    { label: 'Active credits', value: `MK ${totalCreditAmount.toLocaleString()}`, icon: Users, color: 'text-amber-500', trend: `${activeCredits.length} Customers` },
  ];

  const historicalCards = [
    { label: "Total Sales", value: `MK ${totalSalesAllTime.toLocaleString()}`, icon: Receipt, color: 'text-emerald-500' },
    { label: "Total Cost Price", value: `MK ${totalCostAllTime.toLocaleString()}`, icon: Package, color: 'text-rose-500' },
    { label: "Total Profit Made", value: `MK ${totalProfitAllTime.toLocaleString()}`, icon: TrendingUp, color: 'text-primary-500' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background transition-all pb-24 md:pb-0 px-0">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="glass-panel border-b border-border/50 px-6 md:px-12 py-6 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-tighter">Business Overview</h1>
          </div>
        </div>
      </div>

      <div className="px-0 py-0 md:px-0 md:py-0">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 stagger-children">
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
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${stat.trend.includes('outflow') || stat.trend.includes('Customers') || stat.trend.includes('margin') ? 'bg-primary/10 text-primary' : stat.trend.startsWith('+') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {stat.trend.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>
              <div className="text-3xl font-black tracking-tighter mb-1 text-foreground">{stat.value}</div>
              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Historical Financials Section */}
        <div className="glass-panel border-y border-border/50">
          <div className="px-12 py-4 border-b border-border/50">
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Cumulative Financial Performance</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 stagger-children">
            {historicalCards.map((stat, i) => (
              <div key={i} className="p-10 border-r border-border/50 last:border-r-0 hover:bg-muted/5 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-2 rounded-xl bg-muted/10 border border-border/50 ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                </div>
                <div className="text-4xl font-black tracking-tighter text-foreground">
                  <span className="text-xs text-muted-foreground/40 mr-2 font-mono uppercase">MWK</span>
                  {stat.value.replace('MK ', '')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t border-border/50">
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
                    <YAxis 
                      hide
                    />
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

        {/* Expenses & Low Stock Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-border/50 stagger-children">
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
                 {expenses?.slice(0, 5).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((expense, i) => (
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
                 {(!expenses || expenses.length === 0) && (
                    <div className="p-10 text-center text-muted-foreground/20 font-bold text-xs tracking-widest uppercase">No expenses recorded</div>
                 )}
              </div>
           </div>

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
        </div>

        {/* Credit Customers */}
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
      </div>

    </div>
  );
};

export default DashboardPage;

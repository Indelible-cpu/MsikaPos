import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  TrendingUp, 
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
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import AiAssistant from '../components/AiAssistant';

interface DashboardStats {
  today_sales: number;
  today_profit: number;
  today_expenses: number;
  total_sales: number;
  total_cost: number;
  total_profit: number;
  total_transactions: number;
  active_products: number;
  low_stock: number;
  credit_reminders: number;
  chart_data: Array<{ name: string; revenue: number; customers: number }>;
}

interface Expense {
  amount: number;
  createdAt: string;
  description: string;
  category: string;
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashRes, expRes, prodRes, credRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/expenses'),
          api.get('/products'),
          api.get('/credits'),
        ]);
        if (dashRes.data.success) setStats(dashRes.data.data);
        if (expRes.data.success) setExpenses(expRes.data.data);
        if (prodRes.data.success) setProducts(prodRes.data.data);
        if (credRes.data.success) setCredits(credRes.data.data);
      } catch (e) {
        console.error('Dashboard load error:', e);
      }
    };
    load();
  }, []);

  const totalRevenueToday = stats?.today_sales || 0;
  const totalProfitToday = stats?.today_profit || 0;
  const totalExpensesToday = stats?.today_expenses || 0;
  
  const totalSalesAllTime = stats?.total_sales || 0;
  const totalProfitAllTime = stats?.total_profit || 0;
  const totalCostAllTime = stats?.total_cost || 0;

  const activeCredits = credits.filter((c: Credit) => c.status !== 'Paid');
  const totalCreditAmount = activeCredits.reduce((sum: number, c: Credit) => sum + (c.current_total - c.paid_amount), 0);
  const lowStockItems = products.filter((p: Product) => !p.isService && p.quantity <= 5);
  const chartData = stats?.chart_data || [];

  const statCards = [
    { label: "Today's sales", value: `MK ${totalRevenueToday.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', trend: '+Today' },
    { label: "Today's profit", value: `MK ${totalProfitToday.toLocaleString()}`, icon: TrendingUp, color: 'text-primary-400', trend: 'Net margin' },
    { label: "Today's expenses", value: `MK ${totalExpensesToday.toLocaleString()}`, icon: Wallet, color: 'text-rose-500', trend: 'Daily outflow' },
    { label: 'Active credits', value: `MK ${totalCreditAmount.toLocaleString()}`, icon: Users, color: 'text-amber-500', trend: `${activeCredits.length} Users` },
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
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1"></div>
        <div className="flex items-center gap-4">
           <div className="text-right">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Local Session</div>
              <div className="text-xs font-black text-success uppercase">System Online</div>
           </div>
           <div className="w-3 h-3 bg-success rounded-full animate-pulse shadow-lg shadow-success/50" />
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
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${stat.trend.includes('outflow') || stat.trend.includes('Users') || stat.trend.includes('margin') ? 'bg-primary/10 text-primary' : stat.trend.startsWith('+') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
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
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
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
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--color-primary-500)" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="customers" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="transparent" 
                    />
                  </AreaChart>
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
                 {expenses?.slice(0, 5).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((expense, i) => (
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
      <AiAssistant type="DASHBOARD_INSIGHTS" context={stats} />
    </div>
  );
};

export default DashboardPage;

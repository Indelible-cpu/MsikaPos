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

  const totalRevenue = stats?.today_sales || 0;
  const totalExpensesAmt = expenses.reduce((sum: number, e: Expense) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpensesAmt;
  const activeCredits = credits.filter((c: Credit) => c.status !== 'Paid');
  const totalCreditAmount = activeCredits.reduce((sum: number, c: Credit) => sum + (c.current_total - c.paid_amount), 0);
  const lowStockItems = products.filter((p: Product) => !p.isService && p.quantity <= 5);
  const chartData = stats?.chart_data || [];

  const statCards = [
    { label: "Today's Sales", value: `MK ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', trend: '+Today' },
    { label: 'Total Expenses', value: `MK ${totalExpensesAmt.toLocaleString()}`, icon: Wallet, color: 'text-rose-500', trend: 'Monthly Spending' },
    { label: 'Net Profit', value: `MK ${netProfit.toLocaleString()}`, icon: TrendingUp, color: 'text-primary-400', trend: 'After Expenses' },
    { label: 'Active Credits', value: `MK ${totalCreditAmount.toLocaleString()}`, icon: Users, color: 'text-amber-500', trend: `${activeCredits.length} Users` },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <div className="px-0 py-0 md:px-0 md:py-0">

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-8 transition-all duration-500 border-b md:border-b-0 md:border-r border-surface-border/50"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl bg-surface-bg border border-surface-border group-hover:border-primary-500/20 transition-colors ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${stat.trend.includes('spending') || stat.trend.includes('Users') || stat.trend.includes('Expenses') ? 'bg-primary-500/10 text-primary-500' : stat.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stat.trend.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>
              <div className="text-3xl font-black tracking-tighter mb-1">{stat.value}</div>
              <div className="card-label">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t border-surface-border">
           {/* Revenue & Customer Flow Chart */}
           <div className="lg:col-span-2 p-6 md:p-12 relative overflow-hidden md:border-r border-surface-border/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                 <div>
                    <h3 className="text-base font-black tracking-tighter text-primary-500 uppercase">Business Analytics</h3>
                    <div className="card-label">Revenue vs Customer Flow (Last 7 Days)</div>
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
           <div className="p-6 md:p-12">
              <div className="mb-10">
                 <h3 className="text-base font-black tracking-tighter text-amber-500 uppercase">Peak Flow</h3>
                 <div className="card-label">Transactions per day</div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-surface-border">
           <div className="p-6 md:p-12 md:border-r border-surface-border/50">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-sm font-black text-surface-text/40 uppercase">Recent Expenses</h3>
                 <div className="flex gap-4 items-center">
                    <Link to="/staff/expenses" className="text-[10px] font-black text-primary-400 hover:underline">MANAGE ALL</Link>
                    <Link to="/staff/expenses" className="p-2 bg-primary-500 text-white rounded-lg active:scale-95 transition-all shadow-lg shadow-primary-500/20" title="Add Expense">
                       <Plus className="w-3 h-3" />
                    </Link>
                 </div>
              </div>
              <div className="space-y-4">
                 {expenses?.slice(0, 5).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((expense, i) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-transparent border-b border-surface-border/50 group hover:bg-surface-card/5 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                            <Receipt className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{expense.description}</div>
                            <div className="card-label !mb-0">{expense.category}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black text-rose-500">- MK {expense.amount.toLocaleString()}</div>
                      </div>
                   </div>
                 ))}
                 {(!expenses || expenses.length === 0) && (
                    <div className="p-10 text-center text-surface-text/20 font-bold text-xs tracking-widest">No expenses recorded</div>
                 )}
              </div>
           </div>

           <div className="p-6 md:p-12">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-sm font-black text-surface-text/40 uppercase">Low Stock Alert</h3>
                 <Link to="/staff/inventory" className="text-[10px] font-black text-primary-400 hover:underline uppercase">Manage inventory</Link>
              </div>
              <div className="space-y-4">
                 {lowStockItems.slice(0, 5).map((p: Product, i: number) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-transparent border-b border-surface-border/50 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5" />
                         </div>
                         <div>
                            <div className="text-xs font-black">{p.name}</div>
                            <div className="text-[9px] text-surface-text/30 font-bold tracking-wider">SKU: {p.sku}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-black text-red-500">{p.quantity}</div>
                         <div className="text-[8px] text-surface-text/20 font-black">Left in stock</div>
                      </div>
                   </div>
                 ))}
                 {lowStockItems.length === 0 && (
                    <div className="p-10 text-center text-emerald-500/20 font-bold text-xs tracking-widest">All stock levels healthy</div>
                 )}
              </div>
           </div>
        </div>

        {/* Credit Customers */}
        <div className="p-6 md:p-12 border-t border-surface-border">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-sm font-black text-surface-text/40 uppercase">Active Credits</h3>
              <Link to="/staff/debt" className="text-[10px] font-black text-primary-400 hover:underline uppercase">Manage all</Link>
           </div>
           <div className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
              {activeCredits?.slice(0, 6).map((customer: Credit, i: number) => (
                <div key={i} className="flex justify-between items-center p-4 bg-transparent border-b border-surface-border/50 group hover:bg-surface-card/5 transition-all">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                         <Users className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="text-xs font-black">{customer.customer_name}</div>
                         <div className="card-label !mb-0">{customer.customer_phone}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-sm font-black text-red-500">MK {(customer.current_total - customer.paid_amount).toLocaleString()}</div>
                   </div>
                </div>
              ))}
              {(!activeCredits || activeCredits.length === 0) && (
                 <div className="col-span-full p-10 text-center text-surface-text/20 font-bold text-xs tracking-widest">No active credits</div>
              )}
           </div>
        </div>
      </div>
      <AiAssistant type="DASHBOARD_INSIGHTS" context={stats} />
    </div>
  );
};

export default DashboardPage;

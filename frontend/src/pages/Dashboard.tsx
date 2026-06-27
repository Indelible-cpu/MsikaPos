import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/posDB';
import { useAuthStore } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useSettingsStore } from '../hooks/useSettings';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { 
  Bell, LogOut, Menu, 
  ChevronRight, TrendingUp, Monitor, Package, 
  History, Receipt, Users, LayoutDashboard, 
  CreditCard as CreditCardIcon, PlusCircle, AlertCircle,
  Wifi, WifiOff, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { clsx } from 'clsx';

// Sub-pages
import POSPage from './POSPage';
import InventoryPage from './InventoryPage';
import TransactionsPage from './TransactionsPage';
import UsersPage from './UsersPage';
import SettingsPage from './SettingsPage';
import ExpensesPage from './ExpensesPage';

interface RecentActivity {
  invoice_no: string;
  total: number;
  username: string;
  createdAt?: string;
}

interface DashboardStats {
  today_sales: number;
  today_profit: number;
  today_expenses: number;
  total_sales: number;
  total_cost: number;
  total_profit: number;
  total_expenses: number;
  net_profit: number;
  total_transactions: number;
  active_products: number;
  low_stock: number;
  credit_reminders: number;
  recent_activity: RecentActivity[];
  chart_data: { name: string, revenue: number, customers: number }[];
}

// Reusable Stat Card Component
const StatCard = ({ title, value, subtext, icon: Icon, color, loading }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 transition-all hover:shadow-md group">
    <div className="flex justify-between items-start mb-4">
      <div className={clsx("p-2 rounded-lg transition-colors", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className={clsx("text-[10px] font-bold px-2 py-1 rounded-full", color)}>Data</span>
    </div>
    <p className="text-zinc-500 text-xs font-bold mb-1">{title}</p>
    {loading ? (
      <div className="h-8 w-32 bg-zinc-100 animate-pulse rounded-lg" />
    ) : (
      <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{value}</h2>
    )}
    <p className="text-[10px] text-zinc-400 mt-2 font-medium">{subtext}</p>
  </div>
);

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { shopName } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const { isOnline, isFetching, lastSynced } = useLiveStatus();

  // Sync tab with URL
  useEffect(() => {
    const path = location.pathname.split('/')[1];
    const map: Record<string, string> = {
      'dashboard': 'dashboard',
      'pos': 'pos',
      'inventory': 'inventory',
      'history': 'transactions',
      'credits': 'credits',
      'expenses': 'expenses',
      'staff': 'users',
      'settings': 'settings'
    };
    if (map[path]) setActiveTab(map[path]);
  }, [location]);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
    const routes: Record<string, string> = {
      'pos': '/pos',
      'inventory': '/inventory',
      'transactions': '/history',
      'credits': '/credits',
      'expenses': '/expenses',
      'users': '/staff',
      'settings': '/settings',
      'dashboard': '/dashboard'
    };
    navigate(routes[id] || '/dashboard');
  };

  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 300000, // 5 minutes
    staleTime: 60000
  });
  
  const totalCredit = useLiveQuery(
    () => db.customers.where('balance').above(0).toArray().then(arr => arr.reduce((s, c) => s + (c.balance || 0), 0)),
    []
  ) ?? 0;

  const navItems = useMemo(() => [
    { id: 'pos', icon: Monitor, label: 'POS', roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'] },
    { id: 'inventory', icon: Package, label: 'Inventory', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'transactions', icon: History, label: 'Sales history', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'expenses', icon: Receipt, label: 'Expenses', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'users', icon: Users, label: 'Staff management', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview', roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'] }
  ], []);

  if (!user) return null;

  const filteredNav = navItems.filter(item => item.roles.includes(user.role?.toUpperCase()));

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-50 font-['Inter'] antialiased text-zinc-900 overflow-hidden">
      {/* Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      {/* Sidebar */}
      <aside className={clsx(
        "fixed lg:sticky top-0 left-0 z-40 h-[100dvh] w-60 bg-white border-r border-zinc-200 transition-transform lg:translate-x-0 flex flex-col py-6 px-3",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="mb-10 px-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-black text-xl">M</div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-zinc-900">MsikaPos</h1>
            <p className="text-[9px] tracking-widest text-zinc-400 font-bold uppercase">{shopName || 'Premium POS'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                activeTab === item.id ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/10" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              )}
            >
              <item.icon className={clsx("w-5 h-5", activeTab === item.id ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-900")} />
              <span className="text-sm font-bold">{item.label}</span>
              {activeTab === item.id && <ChevronRight className="ml-auto w-4 h-4 text-zinc-500" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-50">
          <button onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-50 hover:text-red-600 rounded-xl transition-all group">
            <LogOut className="w-5 h-5 text-zinc-400 group-hover:text-red-500" />
            <span className="text-sm font-bold">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        <header className="h-16 border-b border-zinc-100 bg-white px-4 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-zinc-100 rounded-xl" title="Open menu" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* ── Global Live Indicator ── */}
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
              !isOnline
                ? 'bg-red-50 text-red-500 border-red-100'
                : isFetching
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              {!isOnline ? (
                <WifiOff className="w-3 h-3" />
              ) : isFetching ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi className="w-3 h-3" />
                </>
              )}
              <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">
                {!isOnline
                  ? 'Offline'
                  : isFetching
                  ? 'Syncing…'
                  : lastSynced
                  ? `Live · ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Live'}
              </span>
            </div>
             <button className="p-2 hover:bg-zinc-100 rounded-full relative">
               <Bell className="w-5 h-5 text-zinc-500" />
               {(stats?.credit_reminders || 0) > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}
             </button>
             <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-xs">
                {user.username?.charAt(0).toUpperCase()}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {activeTab === 'dashboard' ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-bold">Failed to load live metrics. Showing cached data.</span>
                </div>
              )}

              {/* Stat Cards */}
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-lg font-black tracking-tight text-zinc-800">Overview</h3>
                <button 
                  onClick={() => setShowSensitive(!showSensitive)} 
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-all text-xs font-bold shadow-sm"
                >
                  {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showSensitive ? 'Hide Sensitive Data' : 'Show Sensitive Data'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total Revenue" 
                  value={`MK ${stats?.total_sales?.toLocaleString() || '0'}`} 
                  subtext={`Today: MK ${stats?.today_sales?.toLocaleString() || '0'}`}
                  icon={CreditCardIcon}
                  color="bg-emerald-50 text-emerald-600"
                  loading={isLoading}
                />
                <StatCard 
                  title="Net Profit" 
                  value={showSensitive ? `MK ${stats?.net_profit?.toLocaleString() || '0'}` : '****'} 
                  subtext={showSensitive ? `Gross: MK ${stats?.total_profit?.toLocaleString() || '0'}` : '****'}
                  icon={TrendingUp}
                  color="bg-blue-50 text-blue-600"
                  loading={isLoading}
                />
                <StatCard 
                  title="Total Expenses" 
                  value={`MK ${stats?.total_expenses?.toLocaleString() || '0'}`} 
                  subtext={`Today: MK ${stats?.today_expenses?.toLocaleString() || '0'}`}
                  icon={Receipt}
                  color="bg-rose-50 text-rose-600"
                  loading={isLoading}
                />
                <StatCard 
                  title="Outstanding Credit" 
                  value={`MK ${totalCredit.toLocaleString()}`} 
                  subtext={`${stats?.credit_reminders || 0} collections due soon`}
                  icon={Users}
                  color="bg-amber-50 text-amber-600"
                  loading={isLoading}
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm overflow-hidden relative">
                   <div className="flex justify-between items-center mb-10">
                     <div>
                       <h3 className="text-xl font-black tracking-tighter">Revenue Flow</h3>
                       <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1">7 Day Activity</p>
                     </div>
                     <div className="p-2 bg-zinc-50 rounded-xl"><History className="w-5 h-5 text-zinc-400" /></div>
                   </div>
                   
                   <div className="h-64 flex items-end justify-between gap-4">
                     {stats?.chart_data?.map((day, i) => {
                       const max = Math.max(...stats.chart_data.map(d => d.revenue), 1);
                       const height = (day.revenue / max) * 100;
                       return (
                         <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                           <div className="w-full bg-zinc-50 rounded-2xl relative h-60 flex items-end overflow-hidden">
                              <div 
                                className="w-full bg-zinc-900 rounded-xl transition-all duration-1000 ease-out group-hover:bg-emerald-500" 
                                style={{ height: `${Math.max(height, 5)}%` } as React.CSSProperties} 
                              />
                              <div className="absolute inset-x-0 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none bg-zinc-900 text-white text-[10px] font-black px-2 py-1 rounded-lg text-center">
                                MK {day.revenue.toLocaleString()}
                              </div>
                           </div>
                           <span className="text-[10px] font-black uppercase text-zinc-400">{day.name}</span>
                         </div>
                       );
                     })}
                   </div>
                </div>

                {/* Quick Actions & Recent */}
                <div className="space-y-6">
                  <button onClick={() => handleTabChange('pos')} className="w-full p-8 bg-zinc-900 text-white rounded-[2rem] shadow-xl shadow-zinc-900/20 flex flex-col items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all group">
                    <div className="p-4 bg-white/10 rounded-2xl group-hover:bg-emerald-500 transition-colors">
                      <PlusCircle className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black tracking-tight">New Transaction</p>
                      <p className="text-xs font-bold text-zinc-500 uppercase">Open point of sale</p>
                    </div>
                  </button>

                  <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6">Recent Activity</h4>
                    <div className="space-y-4">
                      {stats?.recent_activity?.slice(0, 3).map((sale, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 hover:bg-zinc-50 rounded-2xl transition-all">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center font-black text-zinc-400">
                             {sale.username.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black truncate">#{sale.invoice_no}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">{sale.username}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-xs font-black text-emerald-600">MK {sale.total.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {activeTab === 'pos' && <POSPage />}
              {activeTab === 'inventory' && <InventoryPage />}
              {activeTab === 'users' && <UsersPage />}
              {activeTab === 'transactions' && <TransactionsPage />}
              {activeTab === 'settings' && <SettingsPage />}
              {activeTab === 'expenses' && <ExpensesPage />}
            </div>
          )}
        </div>
      </main>

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
             <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <LogOut className="w-10 h-10" />
             </div>
             <h3 className="text-2xl font-black tracking-tight mb-2">Sign out?</h3>
             <p className="text-sm font-medium text-zinc-400 mb-8">You will need to login again to access your store data.</p>
             <div className="space-y-3">
               <button onClick={() => { logout(); navigate('/login'); }} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-500/20 active:scale-95 transition-all">SIGN OUT NOW</button>
               <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-black text-sm">STAY LOGGED IN</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

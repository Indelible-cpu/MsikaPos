import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useSettingsStore } from '../hooks/useSettings';
import { 
  Bell,
  Search,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  ChevronRight,
  MoreVertical,
  TrendingUp,
  Monitor,
  Package,
  History,
  CreditCard,
  Receipt,
  Users,
  Store,
  LayoutDashboard,
  User as UserIcon,
  AlertTriangle,
  CreditCard as CreditCardIcon,
  ShoppingCart as ShoppingCartIcon,
  PlusCircle
} from 'lucide-react';

// Sub-pages
import POSPage from './POSPage';
import InventoryPage from './InventoryPage';
import TransactionsPage from './TransactionsPage';
import UsersPage from './UsersPage';
import SettingsPage from './SettingsPage';
import ExpensesPage from './ExpensesPage';
import BranchesPage from './BranchesPage';
import CreditsPage from './CreditsPage';

interface RecentActivity {
  invoice_no: string;
  total: number;
  username: string;
}

interface DashboardStats {
  today_sales: number;
  total_transactions: number;
  active_products: number;
  low_stock: number;
  credit_reminders: number;
  recent_activity: RecentActivity[];
  chart_data: { date: string, total: number }[];
}



export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { shopName } = useSettingsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    setTimeout(() => {
      const path = location.pathname.split('/')[1];
      if (path === 'dashboard') setActiveTab('dashboard');
      else if (path === 'pos') setActiveTab('pos');
      else if (path === 'inventory') setActiveTab('inventory');
      else if (path === 'history') setActiveTab('transactions');
      else if (path === 'credits') setActiveTab('credits');
      else if (path === 'expenses') setActiveTab('expenses');
      else if (path === 'staff') setActiveTab('users');
      else if (path === 'branches') setActiveTab('branches');
      else if (path === 'settings') setActiveTab('settings');
    }, 0);
  }, [location]);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
    // Update URL without full refresh
    if (id === 'pos') navigate('/pos');
    else if (id === 'inventory') navigate('/inventory');
    else if (id === 'transactions') navigate('/history');
    else if (id === 'credits') navigate('/credits');
    else if (id === 'expenses') navigate('/expenses');
    else if (id === 'users') navigate('/staff');
    else if (id === 'branches') navigate('/branches');
    else if (id === 'settings') navigate('/settings');
    else navigate('/dashboard');
  };

  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await api.get('/dashboard/stats');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { id: 'pos', icon: Monitor, label: 'POS', roles: ['superadmin', 'admin', 'cashier'] },
    { id: 'inventory', icon: Package, label: 'Inventory', roles: ['superadmin', 'admin'] },
    { id: 'transactions', icon: History, label: 'Sales History', roles: ['superadmin', 'admin'] },
    { id: 'credits', icon: CreditCard, label: 'Credits', roles: ['superadmin', 'admin'] },
    { id: 'expenses', icon: Receipt, label: 'Expenses', roles: ['superadmin', 'admin'] },
    { id: 'users', icon: Users, label: 'Staff', roles: ['superadmin', 'admin'] },
    { id: 'branches', icon: Store, label: 'Branches', roles: ['superadmin'] },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview', roles: ['superadmin', 'admin', 'cashier'] },
  ];

  if (!user) return null;

  const userRole = user.role?.toLowerCase() || '';
  const filteredNav = navItems.filter(item => {
    return item.roles.map(r => r.toLowerCase()).includes(userRole);
  });

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-50 font-['Inter'] antialiased text-zinc-900 overflow-hidden">
      {/* Sidebar Backdrop (Mobile only) */}
      <div 
        className={`fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />
      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-[100dvh] w-52 lg:w-60 bg-white border-r border-zinc-200 
        transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col py-6 px-3 space-y-1
      `}>
        <div className="mb-10 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-zinc-200 overflow-hidden shadow-sm">
              <img src="/icon.png" alt="MsikaPos" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-zinc-900">MsikaPos</h1>
              <p className="text-[10px] tracking-[0.2em] text-zinc-700 font-bold -mt-1">{shopName || 'Management suite'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm' 
                  : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-emerald-500' : 'text-zinc-600 group-hover:text-zinc-800'}`} />
              <span className="text-sm tracking-wide">{item.label}</span>
              {activeTab === item.id && <ChevronRight className="ml-auto w-4 h-4" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-4 px-4 py-3 w-full hover:bg-zinc-50 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-red-50 transition-colors">
              {user.profile_pic ? (
                <img alt="User" className="w-full h-full object-cover" src={user.profile_pic} />
              ) : (
                <UserIcon className="w-5 h-5 text-zinc-700 group-hover:text-red-400" />
              )}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-xs font-bold text-zinc-900 truncate">{user.fullname}</p>
              <p className="text-[10px] text-zinc-700">{user.role}</p>
              {user.phone && <p className="text-[9px] text-emerald-600 font-mono mt-0.5">{user.phone}</p>}
            </div>
            <LogOut className="ml-auto w-4 h-4 text-zinc-300 group-hover:text-red-500" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        {/* Header */}
        <header className="sticky top-0 w-full z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200 flex justify-between items-center h-16 px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all" title="Menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 w-4 h-4" />
              <input 
                className="bg-zinc-100 border-none rounded-full pl-12 pr-6 py-2.5 text-sm w-96 focus:ring-2 focus:ring-emerald-500/20 text-zinc-900 placeholder-zinc-400 transition-all outline-none" 
                placeholder="Search orders, SKU or staff..." 
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <button aria-label="Notifications" title="Notifications" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-800 transition-all relative">
              <Bell className="w-5 h-5" />
              {(statsData?.credit_reminders ?? 0) > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button aria-label="Settings" title="Settings" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-800 transition-all" onClick={() => setActiveTab('settings')}>
              <SettingsIcon className="w-5 h-5" />
            </button>
            <div className="h-8 w-[1px] bg-zinc-200 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-600 leading-none">Online</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
          <div className={`${activeTab === 'pos' ? 'h-full' : 'p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in'}`}>
            {activeTab === 'dashboard' ? (
              <>
                {/* Stats Cards */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 transition-all hover:shadow-md group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-500">
                        <CreditCardIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12.5%</span>
                    </div>
                    <p className="text-zinc-700 text-xs font-bold mb-1">Daily revenue</p>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">MK {statsData?.today_sales?.toLocaleString() || '0'}</h2>
                    <div className="mt-4 h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[75%]"></div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 transition-all hover:shadow-md group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors text-blue-500">
                        <ShoppingCartIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">+8.2%</span>
                    </div>
                    <p className="text-zinc-700 text-xs font-bold mb-1">Order count</p>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{statsData?.total_transactions || '0'}</h2>
                    <p className="text-[10px] text-zinc-700 mt-2  font-medium">Across all branches</p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 transition-all hover:shadow-md group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors text-amber-500">
                        <Package className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-zinc-700 text-xs font-bold mb-1">Active SKUs</p>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">{statsData?.active_products || '0'}</h2>
                    <p className="text-[10px] text-zinc-700 mt-2 font-medium">In current local database</p>
                  </div>

                  <div className={`p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md group ${statsData?.low_stock && statsData.low_stock > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-zinc-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-lg transition-colors ${statsData?.low_stock && statsData.low_stock > 0 ? 'bg-red-500 text-white' : 'bg-zinc-50 text-zinc-700'}`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      {statsData?.low_stock && statsData.low_stock > 0 && (
                        <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-1 rounded-full animate-pulse">Critical</span>
                      )}
                    </div>
                    <p className={`${statsData?.low_stock && statsData.low_stock > 0 ? 'text-red-600' : 'text-zinc-700'} text-xs font-bold mb-1`}>Low stock alerts</p>
                    <h2 className={`text-3xl font-black tracking-tight ${statsData?.low_stock && statsData.low_stock > 0 ? 'text-red-700' : 'text-zinc-900'}`}>{statsData?.low_stock || '0'}</h2>
                    <p className={`text-[10px] mt-2 font-medium ${statsData?.low_stock && statsData.low_stock > 0 ? 'text-red-500' : 'text-zinc-700'}`}>Requires immediate restock</p>
                  </div>
                </section>

                {/* Bento Section */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Sales Chart */}
                  <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-10">
                        <div>
                          <h3 className="text-xl font-black text-zinc-900 tracking-tight">Sales Activity</h3>
                          <p className="text-xs text-zinc-700 font-medium">Revenue performance over the last 7 days</p>
                        </div>
                        <div className="flex gap-2 p-1 bg-zinc-50 rounded-lg">
                          <button className="px-4 py-1.5 bg-white shadow-sm rounded-md text-[10px] font-bold text-zinc-900">Weekly</button>
                          <button className="px-4 py-1.5 hover:bg-white/50 rounded-md text-[10px] font-bold text-zinc-700 transition-all">Monthly</button>
                        </div>
                      </div>
                      
                      <div className="h-64 w-full flex items-end justify-between gap-3 px-2">
                        {statsData?.chart_data?.map((day, i) => {
                          const maxTotal = Math.max(...(statsData.chart_data?.map(d => d.total) || [1]), 1);
                          const height = (day.total / maxTotal) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar">
                              <div className="w-full bg-zinc-50 rounded-t-xl relative h-full flex flex-col justify-end overflow-hidden">
                                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                  <rect 
                                    x="0" 
                                    y={100 - Math.max(height, 5)} 
                                    width="100" 
                                    height={Math.max(height, 5)} 
                                    rx="10"
                                    ry="10"
                                    className="fill-emerald-500 transition-all duration-700 ease-out group-hover/bar:fill-emerald-600 cursor-pointer"
                                  />
                                </svg>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover/bar:opacity-100 transition-all shadow-xl whitespace-nowrap pointer-events-none">
                                  MK {day.total.toLocaleString()}
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-zinc-700 tracking-tighter">{day.date}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 flex-1 relative overflow-hidden group">
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-zinc-900 mb-6 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-500" /> Stock insights
                        </h4>
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-700 font-medium">Top category</span>
                            <span className="text-xs font-bold text-zinc-900 tracking-tight">Retail goods</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-700 font-medium">Turnover rate</span>
                            <span className="text-xs font-bold text-emerald-500 tracking-tight">4.2x daily</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-zinc-50 pt-4">
                            <span className="text-xs text-zinc-700 font-medium">System version</span>
                            <span className="text-[10px] font-bold text-zinc-300">v2.0.4 Premium</span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute right-[-20%] bottom-[-20%] opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                         <TrendingUp className="w-[12rem] h-[12rem]" />
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('pos')}
                      className="w-full py-6 rounded-2xl bg-zinc-900 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-zinc-900/10 hover:shadow-zinc-900/20 active:scale-95 transition-all group"
                    >
                      <PlusCircle className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-sm">New transaction</span>
                    </button>
                  </div>
                </section>

                {/* Table Section */}
                <section className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                  <div className="px-8 py-6 flex justify-between items-center border-b border-zinc-50 bg-zinc-50/10">
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Recent sales</h3>
                      <p className="text-xs text-zinc-700 font-medium">Live feed of global branch transactions</p>
                    </div>
                    <button onClick={() => setActiveTab('transactions')} className="text-emerald-500 text-[10px] font-bold hover:underline transition-all">View all records</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] text-zinc-700 font-bold border-b border-zinc-50">
                          <th className="px-8 py-5">Date & time</th>
                          <th className="px-8 py-5">Cashier</th>
                          <th className="px-8 py-5 text-right">Amount</th>
                          <th className="px-8 py-5 text-center">Status</th>
                          <th className="px-8 py-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {statsData?.recent_activity?.map((sale, i) => (
                          <tr key={i} className="group hover:bg-zinc-50 transition-colors">
                            <td className="px-8 py-5">
                              <div className="text-sm font-bold text-zinc-700">Recent transaction</div>
                              <div className="text-[10px] text-zinc-700 font-bold font-mono">#{sale.invoice_no}</div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-800">
                                  {sale.username?.charAt(0)}
                                </div>
                                <div className="text-sm font-bold text-zinc-700">{sale.username}</div>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-sm font-black text-zinc-900 text-right font-mono">MK {sale.total.toLocaleString()}</td>
                            <td className="px-8 py-5 text-center">
                              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100">Completed</span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <button aria-label="More Actions" title="More Actions" className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-700 hover:text-zinc-900 transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <div className="min-h-full">
                {activeTab === 'pos' && <POSPage />}
                {activeTab === 'inventory' && <InventoryPage />}
                {activeTab === 'users' && <UsersPage />}
                {activeTab === 'transactions' && <TransactionsPage />}
                {activeTab === 'settings' && <SettingsPage />}
                {activeTab === 'credits' && <CreditsPage />}
                {activeTab === 'expenses' && <ExpensesPage />}
                {activeTab === 'branches' && <BranchesPage />}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Logout Overlay */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowLogoutConfirm(false)}>
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-10 text-center animate-fade-up shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce">
                 <LogOut className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2 tracking-tight">Sign out?</h3>
              <p className="text-xs font-semibold text-zinc-400 mb-10 px-4">Are you sure you want to end your session?</p>
              <div className="flex flex-col gap-3">
                 <button onClick={handleLogout} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95">Yes, sign out</button>
                 <button onClick={() => setShowLogoutConfirm(false)} className="w-full py-4 bg-zinc-100 text-zinc-500 font-bold text-xs rounded-2xl transition-all hover:bg-zinc-200">Go back</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

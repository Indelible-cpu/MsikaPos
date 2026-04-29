import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  User, 
  Clock, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { AuditService } from '../services/AuditService';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface AuditLog {
  id: string;
  action: string;
  type: 'INFO' | 'WARNING' | 'ERROR';
  details: string;
  username: string;
  createdAt: string;
}

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await AuditService.getLogs();
        setLogs(data);
      } catch {
        toast.error('Failed to load audit logs');
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || log.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'ERROR': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-primary-500" />;
    }
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) return toast.error('No logs to export');
    
    const headers = ['Timestamp', 'User', 'Action', 'Type', 'Details'];
    const rows = filteredLogs.map(l => [
      format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      l.username,
      l.action,
      l.type,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MsikaPos_AuditLogs_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    toast.success('Audit logs exported');
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0 px-0">
      <header className="bg-surface-card border-b border-surface-border px-4 md:px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6 sticky top-0 z-30">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-500 border border-primary-500/20">
                <History className="w-4 h-4" />
             </div>
             <h1 className="text-2xl font-bold tracking-tight">Audit & Security Logs</h1>
          </div>
          <p className="text-[10px] font-medium text-surface-text/40 tracking-wider">Trace system activity and administrative actions</p>
        </div>
        <button 
          onClick={handleExport}
          className="btn-secondary !px-6 !py-4 flex items-center gap-2 text-[10px] font-bold tracking-wider"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Audit CSV
        </button>
      </header>

      <div className="px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by action, user, or details..."
                className="input-field w-full pl-12 text-xs font-medium py-4"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
              {['ALL', 'INFO', 'WARNING', 'ERROR'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={clsx(
                    "px-6 py-2 rounded-xl text-[9px] font-bold tracking-wider transition-all border",
                    typeFilter === t 
                      ? "bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20" 
                      : "bg-surface-card border-surface-border text-surface-text/40 hover:bg-surface-border/50"
                  )}
                >
                  {t}
                </button>
              ))}
           </div>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-3xl overflow-hidden shadow-sm">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-surface-bg/50 border-b border-surface-border text-[9px] font-bold tracking-wider text-surface-text/30">
                    <th className="px-8 py-6">Timestamp</th>
                    <th className="px-8 py-6">User</th>
                    <th className="px-8 py-6">Action</th>
                    <th className="px-8 py-6">Details</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                 {filteredLogs.map(log => (
                   <tr key={log.id} className="group hover:bg-primary-500/[0.02] transition-colors">
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3 text-surface-text/40">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black">{format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}</span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surface-bg border border-surface-border flex items-center justify-center text-surface-text/20 group-hover:text-primary-500 transition-colors">
                               <User className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-black tracking-tight">{log.username}</span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center gap-3">
                            {getLogIcon(log.type)}
                            <span className={clsx(
                              "text-[10px] font-black tracking-widest px-3 py-1 rounded-lg uppercase border",
                              log.type === 'ERROR' ? "text-red-500 border-red-500/10 bg-red-500/5" :
                              log.type === 'WARNING' ? "text-amber-500 border-amber-500/10 bg-amber-500/5" :
                              "text-primary-500 border-primary-500/10 bg-primary-500/5"
                            )}>
                               {log.action}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-6">
                         <p className="text-xs font-bold text-surface-text/70 leading-relaxed">{log.details}</p>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
           {filteredLogs.length === 0 && (
             <div className="py-20 text-center flex flex-col items-center">
                <History className="w-12 h-12 text-surface-text/5 mb-4" />
                <p className="text-[10px] font-black tracking-widest text-surface-text/20 uppercase">No audit trails found for current filter</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;

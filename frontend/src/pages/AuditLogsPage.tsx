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
import { useFeatureAccess } from '../hooks/useFeatureAccess';
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
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('AUDIT_LOGS');
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
      case 'ERROR': return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'WARNING': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-primary" />;
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
    <div className="flex flex-col min-h-screen bg-background transition-all pb-24 md:pb-0 px-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="glass-panel border-b border-border/50 px-4 md:px-8 py-6 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1"></div>
        {!readOnly && (
          <button 
            onClick={handleExport}
            className="btn-secondary !px-6 !py-4 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase btn-press"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export logs
          </button>
        )}
        </div>
      </div>

      <div className="px-0 md:px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8 stagger-children">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by action, user, or details..."
                className="input-field w-full pl-12 text-xs font-black py-4 uppercase"
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
                    "px-6 py-2 rounded-xl text-[9px] font-black tracking-widest transition-all border uppercase btn-press",
                    typeFilter === t 
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                      : "bg-card/50 border-border/50 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {t}
                </button>
              ))}
           </div>
        </div>

        <div className="glass-panel border border-border/50 rounded-[2rem] shadow-sm overflow-hidden stagger-children">
           <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[800px]">
                 <thead>
                    <tr className="bg-muted/10 border-b border-border/50 text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase">
                       <th className="px-8 py-6">Timestamp</th>
                       <th className="px-8 py-6">User</th>
                       <th className="px-8 py-6">Action</th>
                       <th className="px-8 py-6">Details</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/30">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="group hover:bg-primary/5 transition-colors btn-press">
                         <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3 text-muted-foreground">
                               <Clock className="w-3.5 h-3.5" />
                               <span className="text-[10px] font-black">{format(new Date(log.createdAt), 'MMM dd, HH:mm:ss')}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-muted/10 border border-border/50 flex items-center justify-center text-muted-foreground/40 group-hover:text-primary transition-colors">
                                  <User className="w-4 h-4" />
                               </div>
                               <span className="text-sm font-black tracking-tight text-foreground uppercase">{log.username}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                               {getLogIcon(log.type)}
                               <span className={clsx(
                                 "text-[10px] font-black tracking-widest px-3 py-1 rounded-lg uppercase border",
                                 log.type === 'ERROR' ? "text-destructive border-destructive/10 bg-destructive/5" :
                                 log.type === 'WARNING' ? "text-amber-500 border-amber-500/10 bg-amber-500/5" :
                                 "text-primary border-primary/10 bg-primary/5"
                               )}>
                                  {log.action}
                               </span>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <p className="text-xs font-bold text-surface-text/70 leading-relaxed break-words max-w-md">{log.details}</p>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
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

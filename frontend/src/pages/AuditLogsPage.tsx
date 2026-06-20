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
  type: 'Info' | 'Warning' | 'Error';
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
      case 'Error': return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'Warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
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
    <div className="flex flex-col transition-all px-0 relative">

      <div className="bg-background border-b border-border/50 px-4 md:px-8 py-3 sticky top-0 z-40">
        <div className="flex flex-row flex-nowrap items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1">
          <div className="relative flex-[2] min-w-[150px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by action, user, or details..."
              className="input-field w-full pl-11 text-[11px] h-10 font-bold shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative flex-1 min-w-[110px] shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field w-full text-[10px] h-10 font-bold shadow-inner pr-8"
            >
              {['ALL', 'Info', 'Warning', 'Error'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {!readOnly && (
            <button 
              onClick={handleExport}
              className="btn-secondary h-10 !px-4 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase btn-press shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden md:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-0 md:px-4 py-4">
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
                                 log.type === 'Error' ? "text-destructive border-destructive/10 bg-destructive/5" :
                                 log.type === 'Warning' ? "text-amber-500 border-amber-500/10 bg-amber-500/5" :
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

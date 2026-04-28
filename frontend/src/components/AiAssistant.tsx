import React, { useState } from 'react';
import { Sparkles, X, BrainCircuit, Lightbulb, TrendingUp, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';
import { db } from '../db/posDB';

interface AiAssistantProps {
  type: 'DASHBOARD_INSIGHTS' | 'INVENTORY_STRATEGY' | 'SYSTEM_DIAGNOSTICS' | 'GENERAL_SUPPORT';
  context: unknown;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ type, context }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAiHelp = async () => {
    setLoading(true);
    setIsOpen(true);
    try {
      let finalContext: Record<string, unknown> = {};
      if (context && typeof context === 'object') {
        finalContext = { ... (context as Record<string, unknown>) };
      }
      // Get Geolocation
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        finalContext.location = { 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      } catch {
        finalContext.location = "Permission denied or unavailable";
      }

      // If super admin and diagnostic, pull system logs
      if (type === 'SYSTEM_DIAGNOSTICS') {
        const { AuditService } = await import('../services/AuditService');
        const logs = await AuditService.getLogs();
        finalContext = { 
          logs: logs.slice(0, 20), 
          systemInfo: {
            ua: navigator.userAgent,
            online: navigator.onLine,
            storage: await navigator.storage?.estimate?.()
          }
        };
      } else if (type === 'INVENTORY_STRATEGY') {
        // Add velocity data
        const recentSales = await db.salesQueue.limit(100).toArray();
        finalContext.recentSalesSummary = recentSales.map(s => ({ items: s.items.length, total: s.total }));
      }

      const res = await api.post('/ai/suggestions', { type, context: finalContext });
      if (res.data.success) {
        setSuggestion(res.data.data);
      }
    } catch (err: unknown) {
      const errorMsg = (err as any).response?.data?.message || (err as any).message || "Unknown connectivity issue";
      setSuggestion(`Connectivity Error: ${errorMsg}. Please ensure your backend is live and the xAI key is set in Render settings.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={getAiHelp}
        className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-[100] w-14 h-14 bg-gradient-to-tr from-primary-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center group active:scale-90 transition-all hover:scale-110"
        title="MsikaPos AI Brain"
      >
        <div className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20 group-hover:hidden"></div>
        <Sparkles className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-end p-4 md:p-12 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
            >
              <header className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-500/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                    {type === 'SYSTEM_DIAGNOSTICS' ? <ShieldCheck className="w-6 h-6 text-amber-400" /> : <BrainCircuit className="w-6 h-6 text-indigo-400" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tighter italic">{type === 'SYSTEM_DIAGNOSTICS' ? 'Msika Guard' : 'Msika Brain'}</h3>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{type === 'SYSTEM_DIAGNOSTICS' ? 'System Troubleshooting' : 'Advanced Business AI'}</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} title="Close assistant" className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </header>

              <div className="p-8 min-h-[300px] flex flex-col">
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-indigo-500 animate-pulse" />
                    </div>
                    <p className="text-xs font-black text-white/40 tracking-widest animate-pulse">ANALYZING BUSINESS DATA...</p>
                  </div>
                ) : (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex items-start gap-4">
                       <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                          <Lightbulb className="w-4 h-4 text-emerald-400" />
                       </div>
                       <div>
                          <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Insight Discovery</h4>
                          <p className="text-[13px] leading-relaxed text-zinc-300 font-medium whitespace-pre-line">
                            {suggestion}
                          </p>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <TrendingUp className="w-4 h-4 text-primary-400 mb-2" />
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Growth Factor</div>
                          <div className="text-xs font-bold text-white mt-1">High Impact</div>
                       </div>
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                          <ShieldCheck className="w-4 h-4 text-amber-400 mb-2" />
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Risk Analysis</div>
                          <div className="text-xs font-bold text-white mt-1">Secure Sync</div>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              <footer className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase">Powered by xAI Grok Brain</span>
                <button 
                  onClick={getAiHelp}
                  className="px-6 py-3 bg-indigo-500 text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-600 transition-all active:scale-95"
                >
                  Regenerate
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiAssistant;

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { type LocalCustomer } from '../db/posDB';
import { Search, Calendar, UserCheck, ArrowRightCircle, X, Eye } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import Modal from '../components/Modal';
import { Receipt } from '../components/Receipt';

interface Credit {
  id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone: string;
  original_amount: number;
  paid_amount: number;
  due_date: string;
  days_late: number;
  interest: number;
  current_total: number;
  status: 'Pending' | 'Late' | 'Paid';
}

export default function CreditsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ id: number, total: number } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [clearedReceipt, setClearedReceipt] = useState<any | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: credits, isLoading } = useQuery({
    queryKey: ['credits'],
    queryFn: async () => {
      const res = await api.get('/credits');
      return res.data.data as Credit[];
    }
  });

  const payMutation = useMutation({
    mutationFn: async (data: { id: number, amount: number }) => {
      return api.post('/credits/payment', data);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['credits'] });
      
      const credit = credits?.find(c => c.id === variables.id);
      if (credit && Number(payAmount) >= (credit.current_total - credit.paid_amount)) {
          setClearedReceipt({
            items: [{ 
              product: { name: 'Credit Balance Clearance', sellPrice: Number(payAmount), costPrice: 0, id: 0, sku: 'CREDIT-PAY', categoryId: 0, quantity: 1, isService: true } as unknown as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              quantity: 1 
            }],
            total: Number(payAmount),
            subtotal: Number(payAmount),
            discount: 0,
            tax: 0,
            invoiceNo: `REC-${Date.now()}`,
            date: new Date().toISOString(),
            mode: 'Cash',
            paid: Number(payAmount),
            change: 0,
            customerName: credit.customer_name
          });
      }

      setPaymentModal(null);
      setPayAmount('');
      showToast('Payment received and balance updated.');
    }
  });

  const filtered = credits?.filter(c => 
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.invoice_no.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-10 h-full w-full animate-slide-in p-2">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-zinc-800 tracking-tight mb-2">Credit Management</h2>
          <p className="text-zinc-400 text-sm font-medium tracking-wide">Track customer balances and payments.</p>
        </div>
        <div className="bg-white px-6 py-4 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-6">
           <div className="text-right border-r border-zinc-100 pr-6">
              <p className="text-[10px] font-bold text-zinc-400 mb-0.5">Total balances</p>
              <p className="text-lg font-black text-zinc-800 tracking-tighter">MK {(filtered?.reduce((acc, c) => acc + (c.current_total - c.paid_amount), 0) ?? 0).toLocaleString()}</p>
           </div>
           <UserCheck className="w-8 h-8 text-primary opacity-20" />
        </div>
      </header>

      <div className="premium-card p-4 border-none flex items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5 group-focus-within:text-primary transition-colors" />
          <input
            placeholder="Filter by customer name or invoice #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-zinc-50/50 rounded-2xl border border-zinc-100 outline-none font-bold text-xs tracking-[0.1em] focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
          />
        </div>
      </div>

      <div className="premium-card border-none overflow-hidden flex flex-col flex-1 shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="text-[10px] font-bold text-zinc-400 border-b border-zinc-50 bg-zinc-50/50">
                <th className="px-10 py-6">Customer</th>
                <th className="px-10 py-6">Invoice #</th>
                <th className="px-10 py-6">Due date</th>
                <th className="px-10 py-6 text-right">Original amt</th>
                <th className="px-10 py-6 text-right">Late fees</th>
                <th className="px-10 py-6 text-right">Balance due</th>
                <th className="px-10 py-6 text-center">Status</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50/50">
              {isLoading ? (
                <tr><td colSpan={8} className="p-20 text-center text-[10px] font-bold text-zinc-300 animate-pulse">Loading balances...</td></tr>
              ) : filtered?.length === 0 ? (
                <tr><td colSpan={8} className="p-20 text-center text-[10px] font-bold text-zinc-300">No outstanding balances found.</td></tr>
              ) : filtered?.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/80 transition-all group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-4">
                      {/* Customer Biometric Preview */}
                      <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center relative group/bio">
                         <img 
                           src={(c as unknown as LocalCustomer).livePhoto || "/icon.png"} 
                           alt="cust" 
                           className={`w-full h-full object-cover ${!(c as unknown as LocalCustomer).livePhoto && 'opacity-10'}`} 
                         />
                         {(c as unknown as LocalCustomer).fingerprintData && (
                           <div className="absolute top-0 right-0 p-1 bg-emerald-500 rounded-bl-lg">
                             <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                           </div>
                         )}
                         <button 
                           type="button"
                           title="View biometric profile"
                           onClick={() => setSelectedCustomer(c as unknown as LocalCustomer)}
                           className="absolute inset-0 bg-black/40 opacity-0 group-hover/bio:opacity-100 transition-opacity flex items-center justify-center"
                         >
                           <Eye className="w-4 h-4 text-white" />
                         </button>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800 text-sm mb-1 tracking-tight group-hover:text-primary transition-colors">{c.customer_name}</p>
                        <p className="text-[9px] font-bold text-zinc-400">{c.customer_phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-[11px] font-bold text-zinc-500 font-mono">#{c.invoice_no}</td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                       <Calendar className="w-4 h-4 text-zinc-300" />
                       <span className={`text-xs font-black tracking-tight ${c.status === 'Late' ? 'text-rose-600' : 'text-zinc-600'}`}>{c.due_date}</span>
                    </div>
                    {c.days_late > 0 && <p className="text-[9px] font-bold text-rose-500 mt-2 animate-pulse">{c.days_late} days overdue</p>}
                  </td>
                  <td className="px-10 py-8 text-right text-sm font-black text-zinc-600 tracking-tighter">MK {c.original_amount.toLocaleString()}</td>
                  <td className="px-10 py-8 text-right text-sm font-black text-rose-500 tracking-tighter">MK {c.interest.toLocaleString()}</td>
                  <td className="px-10 py-8 text-right">
                    <p className="text-lg font-black text-zinc-900 tracking-tighter">MK {c.current_total.toLocaleString()}</p>
                    {c.paid_amount > 0 && <p className="text-[10px] font-bold text-emerald-500 tracking-tighter">Paid: MK {c.paid_amount.toLocaleString()}</p>}
                  </td>
                  <td className="px-10 py-8 text-center">
                     <span className={`px-4 py-2 rounded-xl text-[9px] font-bold shadow-inner ${
                        c.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                        c.status === 'Late' ? 'bg-rose-50 text-rose-600' :
                        'bg-zinc-50 text-zinc-400'
                     }`}>
                        {c.status}
                     </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    {c.status !== 'Paid' && (
                       <button 
                          onClick={() => { setPaymentModal({ id: c.id, total: c.current_total - c.paid_amount }); setPayAmount(String(c.current_total - c.paid_amount)); }}
                          className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-[10px] shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
                          title="Record a payment for this balance"
                       >
                          Pay balance <ArrowRightCircle className="w-4 h-4" />
                       </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paymentModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-6 animate-blur-fade" onClick={() => setPaymentModal(null)}>
           <div className="premium-card w-full max-w-md overflow-hidden animate-slide-in border-none shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <header className="px-10 py-8 border-b border-zinc-50 bg-white flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-black text-zinc-800 tracking-tight">Pay balance</h3>
                    <p className="text-[10px] font-bold text-zinc-400 mt-1">Record a customer payment.</p>
                 </div>
                 <button onClick={() => setPaymentModal(null)} className="p-3 bg-zinc-50 rounded-xl text-zinc-400 hover:text-zinc-900" title="Close modal"><X className="w-5 h-5" /></button>
              </header>
              <div className="p-10 space-y-10">
                 <div className="space-y-3">
                    <label htmlFor="pay-amt-input" className="text-[10px] font-bold text-zinc-400 ml-1">Payment amount (MK)</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 font-black text-sm font-mono">MK</span>
                       <input 
                          id="pay-amt-input"
                          type="number"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          className="w-full pl-16 pr-6 py-6 bg-zinc-50 rounded-2xl border border-zinc-100 outline-none font-black text-2xl text-zinc-900 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-mono" 
                       />
                    </div>
                    <div className="flex justify-between px-2 pt-2">
                       <span className="text-[10px] font-bold text-zinc-400">Active balance</span>
                       <span className="text-xs font-black text-zinc-800 font-mono">MK {paymentModal.total.toLocaleString()}</span>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setPaymentModal(null)} className="flex-1 py-5 bg-white border border-zinc-100 rounded-2xl font-bold text-[11px] text-zinc-400 hover:bg-zinc-50 transition-all">Cancel</button>
                    <button 
                       onClick={() => payMutation.mutate({ id: paymentModal.id, amount: Number(payAmount) })}
                       disabled={payMutation.isPending}
                       className="flex-[2] py-5 bg-primary text-white rounded-2xl font-bold text-[11px] shadow-xl shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                       {payMutation.isPending ? 'Processing...' : 'Confirm payment'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-zinc-900/80 backdrop-blur-xl p-6" onClick={() => setSelectedCustomer(null)}>
           <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col items-center p-10 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-32 h-32 rounded-[2rem] border-4 border-primary/20 p-1 mb-6">
                <img src={selectedCustomer.livePhoto || "/icon.png"} className="w-full h-full object-cover rounded-[1.5rem]" alt="verification" />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-1">{selectedCustomer.name}</h3>
              <p className="text-[10px] font-black tracking-widest text-zinc-400 mb-8 uppercase">Verified Profile</p>
              
              <div className="w-full space-y-4 mb-10">
                <div className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl">
                   <span className="text-[9px] font-black text-zinc-400 tracking-widest uppercase">National ID</span>
                   <span className="text-xs font-black text-zinc-800">{selectedCustomer.idNumber || 'N/A'}</span>
                </div>
                <div className={`flex justify-between items-center p-4 rounded-2xl border ${selectedCustomer.fingerprintData ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-zinc-50 border-zinc-100 text-zinc-400'}`}>
                   <span className="text-[9px] font-black tracking-widest uppercase">Fingerprint</span>
                   <span className="text-xs font-black">{selectedCustomer.fingerprintData ? 'SECURED: ' + selectedCustomer.fingerprintData.substring(0, 15) + '...' : 'NOT LINKED'}</span>
                </div>
              </div>

              <button onClick={() => setSelectedCustomer(null)} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] tracking-widest">Close Verification</button>
           </div>
        </div>
      )}
      {/* Receipt Modal */}
      <Modal isOpen={!!clearedReceipt} onClose={() => setClearedReceipt(null)} title="Payment Receipt" maxWidth="max-w-md">
        {clearedReceipt && (
           <div className="p-4 flex flex-col items-center">
             <div className="bg-white p-4 shadow-xl border border-zinc-200 w-full flex justify-center" id="printable-receipt">
               <Receipt {...clearedReceipt} />
             </div>
             <button onClick={() => { window.print(); setClearedReceipt(null); }} className="mt-6 w-full py-4 bg-primary text-white rounded-2xl font-black text-[10px] tracking-widest uppercase hover:bg-primary/90 transition-all">
                Print Receipt & Close
             </button>
           </div>
        )}
      </Modal>
    </div>
  );
}

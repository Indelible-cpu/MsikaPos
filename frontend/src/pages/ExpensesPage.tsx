import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalExpense, type LocalProduct } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Trash2, 
  ArrowDownCircle,
  FileText,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Receipt } from '../components/Receipt';
import html2canvas from 'html2canvas';

type ExpenseReceiptProps = React.ComponentProps<typeof Receipt>;

const ExpensesPage: React.FC = () => {
  const { isReadOnly } = useFeatureAccess();
  const readOnly = isReadOnly('FINANCE');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<LocalExpense | null>(null);

  const [formData, setFormData] = useState({
    category: 'Utilities',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash'
  });

  const [expenseReceipt, setExpenseReceipt] = useState<ExpenseReceiptProps | null>(null);

  const expenses = useLiveQuery(
    () => db.expenses
      .filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()))
      .reverse()
      .toArray(),
    [searchTerm]
  );

  const totalSpent = expenses?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0;

  const getAutoFrequency = (dateStr: string): 'Daily' | 'Weekly' | 'Monthly' | 'Annually' => {
    const d = new Date(dateStr);
    const now = new Date();
    // Normalize to midnight for fair day calculation
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((nDate.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff <= 1) return 'Daily';
    if (diff <= 7) return 'Weekly';
    if (diff <= 30) return 'Monthly';
    return 'Annually';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await db.expenses.update(editingExpense.id, { ...formData });
        toast.success('Expense updated');
      } else {
        const expenseId = crypto.randomUUID();
        const expenseData = {
          ...formData,
          id: expenseId,
          frequency: getAutoFrequency(formData.date),
          createdAt: new Date().toISOString(),
          synced: 0
        };
        await db.expenses.add(expenseData);
        
        // Prepare receipt for sharing
        setExpenseReceipt({
          items: [{ product: { name: `EXPENSE: ${formData.description}`, sellPrice: formData.amount } as unknown as LocalProduct, quantity: 1 }],
          total: formData.amount,
          subtotal: formData.amount,
          tax: 0,
          discount: 0,
          invoiceNo: `EXP-${expenseId.substring(0, 6).toUpperCase()}`,
          date: formData.date,
          mode: formData.paymentMethod,
          paid: formData.amount,
          change: 0
        });

        toast.success('Expense recorded');
      }
      setIsModalOpen(false);
      setEditingExpense(null);
      resetForm();
    } catch {
      toast.error('Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this expense record?')) {
      await db.expenses.delete(id);
      toast.success('Record deleted');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'Utilities',
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash'
    });
  };

  const categories = ['Utilities', 'Stock Purchase', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Other'];

  return (
    <div className="flex flex-col min-h-screen bg-background transition-all pb-24 md:pb-0 relative">
      <div className="fixed inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="glass-panel border-b border-border/50 px-6 md:px-12 py-6 sticky top-0 z-30">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1"></div>
        {!readOnly && (
          <button 
            onClick={() => { resetForm(); setEditingExpense(null); setIsModalOpen(true); }}
            className="btn-primary !px-8 !py-4 text-[10px] font-black tracking-widest bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20 w-full md:w-auto uppercase btn-press"
          >
            <Plus className="w-4 h-4 mr-2 inline" /> Add expense
          </button>
        )}
        </div>
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
             <div className="p-4 border-r border-border/30 flex items-center gap-4 glass-card m-2 rounded-2xl">
                <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center">
                   <ArrowDownCircle className="w-6 h-6" />
                </div>
                <div>
                   <div className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Total outflow</div>
                   <div className="text-2xl font-black text-foreground">MK {totalSpent.toLocaleString()}</div>
                </div>
             </div>
             <div className="relative glass-card m-2 rounded-2xl flex items-center flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input 
                   type="text" 
                   placeholder="Search description or category..."
                   className="input-field w-full pl-14 pr-12 text-sm h-full font-bold shadow-inner bg-transparent border-none"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    title="Clear search"
                    aria-label="Clear search"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>

      <div className="p-0 border-t border-border/50 stagger-children">
        <div className="overflow-hidden divide-y divide-border/30">
          {expenses?.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground/20 font-black text-[10px] tracking-widest uppercase">No expenses recorded</div>
          ) : (
            expenses?.map(exp => (
              <div key={exp.id} className="p-6 flex justify-between items-center group hover:bg-destructive/5 transition-colors btn-press">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-background border border-border/50 rounded-xl flex items-center justify-center text-muted-foreground/20 group-hover:text-destructive transition-colors">
                       <FileText className="w-5 h-5" />
                    </div>
                    <div>
                       <div className="font-black text-sm tracking-tight uppercase">{exp.description || 'No description'}</div>
                       <div className="text-[9px] text-muted-foreground font-black tracking-widest uppercase">
                          {exp.category} • {getAutoFrequency(exp.date)} • {exp.date}
                        </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                       <div className="text-base font-black text-destructive">MK {exp.amount.toLocaleString()}</div>
                       <div className="text-[8px] text-muted-foreground/40 font-black tracking-widest uppercase">{exp.paymentMethod}</div>
                    </div>
                    {!readOnly && (
                      <button 
                        title="Delete" 
                        aria-label="Delete expense" 
                        onClick={() => handleDelete(exp.id)} 
                        className="p-2 text-muted-foreground/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 btn-press"
                      >
                       <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                 </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingExpense ? 'Edit Expense' : 'New Expense'}
      >
        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/30 ml-1">Description</label>
              <input required type="text" className="input-field w-full" placeholder="e.g. Electricity Bill" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/30 ml-1">Category</label>
              <select title="Select Category" aria-label="Select Category" className="input-field w-full appearance-none bg-surface-bg" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black  tracking-widest text-surface-text/30 ml-1">Date</label>
              <input type="date" title="Select Date" aria-label="Select Date" placeholder="Select Date" className="input-field w-full font-bold" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black  tracking-widest text-surface-text/30 ml-1">Amount (MK)</label>
            <input required type="number" className="input-field w-full text-3xl font-black text-red-500" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})} onFocus={(e) => e.target.select()} />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-muted/10 border border-border/50 rounded-2xl text-[10px] font-black tracking-widest uppercase btn-press">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black tracking-widest bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20 uppercase btn-press">Save expense</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!expenseReceipt} onClose={() => setExpenseReceipt(null)} title="Expense Voucher">
        {expenseReceipt && (
          <div className="p-6 flex flex-col items-center gap-6">
            <div className="bg-white p-6 w-full" id="expense-voucher"><Receipt {...expenseReceipt} /></div>
            <div className="flex gap-4 w-full">
               <button 
                onClick={async () => {
                  const el = document.getElementById('expense-voucher');
                  if (!el) return;
                  toast.loading('Preparing voucher...', { id: 'share' });
                  try {
                    const canvas = await html2canvas(el);
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                    if (blob) {
                      const file = new File([blob], `voucher-${expenseReceipt.invoiceNo}.png`, { type: 'image/png' });
                      if (navigator.share) {
                        await navigator.share({ files: [file], title: 'Expense Voucher', text: `Voucher for ${formData.description}` });
                        toast.success('Shared successfully', { id: 'share' });
                      } else {
                        const text = encodeURIComponent(`Expense Voucher\nRef: ${expenseReceipt.invoiceNo}\nAmount: MK ${expenseReceipt.total.toLocaleString()}\nDesc: ${formData.description}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                        toast.success('WhatsApp opened', { id: 'share' });
                      }
                    }
                  } catch { toast.error('Failed to share', { id: 'share' }); }
                }}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 uppercase"
              >
                <MessageSquare className="w-4 h-4" /> Share WhatsApp
              </button>
              <button type="button" onClick={() => setExpenseReceipt(null)} className="flex-1 py-4 btn-primary font-black text-[10px] uppercase">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpensesPage;

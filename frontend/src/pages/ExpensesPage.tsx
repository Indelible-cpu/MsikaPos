import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalExpense, type LocalProduct } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Trash2, 
  ArrowDownCircle,
  FileText,
  MessageSquare,
  X,
  Pencil
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

  const [formData, setFormData] = useState<{
    category: string;
    amount: number | '';
    description: string;
    date: string;
    paymentMethod: string;
  }>({
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

  const groupedExpenses = useMemo(() => {
    if (!expenses) return {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = today - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = today - (30 * 24 * 60 * 60 * 1000);

    const groups: Record<string, LocalExpense[]> = {
      'Today': [],
      'This week': [],
      'This month': [],
      'Older': []
    };

    expenses.forEach(exp => {
      const expDate = new Date(exp.date).getTime();
      if (expDate >= today) groups['Today'].push(exp);
      else if (expDate >= oneWeekAgo) groups['This week'].push(exp);
      else if (expDate >= oneMonthAgo) groups['This month'].push(exp);
      else groups['Older'].push(exp);
    });

    return groups;
  }, [expenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await db.expenses.update(editingExpense.id, { ...formData, amount: Number(formData.amount) || 0 });
        toast.success('Expense updated');
      } else {
        const expenseId = crypto.randomUUID();
        const expenseData = {
          ...formData,
          amount: Number(formData.amount) || 0,
          id: expenseId,
          createdAt: new Date().toISOString(),
          synced: 0
        };
        await db.expenses.add(expenseData);
        
        setExpenseReceipt({
          items: [{ product: { name: `Expense: ${formData.description}`, sellPrice: Number(formData.amount) || 0 } as unknown as LocalProduct, quantity: 1 }],
          total: Number(formData.amount) || 0,
          subtotal: Number(formData.amount) || 0,
          tax: 0,
          discount: 0,
          invoiceNo: `EXP-${expenseId.substring(0, 6).toUpperCase()}`,
          date: formData.date,
          mode: formData.paymentMethod,
          paid: Number(formData.amount) || 0,
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

  const categories = ['Utilities', 'Stock purchase', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Other'];

  return (
    <div className="flex flex-col transition-all relative">

      <div className="glass-panel border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-30">
        <div className="flex flex-row flex-nowrap items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-1">
          <div className="relative flex-[2] min-w-[150px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search expenses..."
              className="input-field w-full pl-11 text-[11px] h-10 font-bold shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!readOnly && (
            <button
              onClick={() => { resetForm(); setEditingExpense(null); setIsModalOpen(true); }}
              className="flex items-center gap-1.5 text-[11px] font-black text-primary hover:underline whitespace-nowrap shrink-0 px-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add expense
            </button>
          )}
        </div>
      </div>

      <div className="w-full px-4 md:px-12 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-8 glass-panel rounded-[2rem] border border-border/50 flex items-center gap-6 shadow-xl">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center">
               <ArrowDownCircle className="w-8 h-8" />
            </div>
            <div>
               <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-1">Total outflow</div>
               <div className="text-3xl font-black text-foreground tracking-tighter">MK {totalSpent.toLocaleString()}</div>
            </div>
          </div>

          <div className="p-2 glass-panel rounded-[2rem] border border-border/50 flex items-center shadow-xl">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input 
                 type="text" 
                 placeholder="Search expenses..."
                 className="w-full pl-16 pr-12 py-6 text-sm font-bold bg-transparent outline-none"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  title="Clear search"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-muted/20 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-12 pb-20">
          {Object.entries(groupedExpenses).map(([groupName, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupName} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black tracking-[0.3em] text-primary uppercase whitespace-nowrap">{groupName}</h3>
                  <div className="h-px bg-primary/10 flex-1" />
                </div>
                <div className="glass-panel border border-border/50 rounded-[2.5rem] overflow-hidden shadow-2xl divide-y divide-border/30">
                   {items.map(exp => (
                    <div key={exp.id} className="p-8 flex justify-between items-center group hover:bg-destructive/5 transition-all">
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 bg-background border border-border rounded-2xl flex items-center justify-center text-muted-foreground/20 group-hover:text-destructive group-hover:border-destructive/20 transition-all shadow-inner">
                             <FileText className="w-6 h-6" />
                          </div>
                          <div>
                             <div className="font-black text-lg tracking-tight">{exp.description || 'No description'}</div>
                             <div className="text-[10px] text-muted-foreground font-black tracking-widest uppercase flex items-center gap-2">
                                <span>{exp.category}</span>
                                <span className="w-1 h-1 bg-border rounded-full" />
                                <span>{exp.date}</span>
                              </div>
                          </div>
                       </div>
                       <div className="flex items-center gap-8">
                          <div className="text-right">
                             <div className="text-xl font-black text-destructive tracking-tighter">MK {exp.amount.toLocaleString()}</div>
                             <div className="text-[9px] text-muted-foreground/40 font-black tracking-widest uppercase">{exp.paymentMethod}</div>
                          </div>
                          {!readOnly && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                title="Edit expense"
                                onClick={() => {
                                  setEditingExpense(exp);
                                  setFormData({
                                    category: exp.category,
                                    amount: exp.amount,
                                    description: exp.description,
                                    date: exp.date,
                                    paymentMethod: exp.paymentMethod
                                  });
                                  setIsModalOpen(true);
                                }} 
                                className="p-4 text-muted-foreground/20 hover:text-primary hover:bg-primary/10 rounded-2xl transition-all"
                              >
                               <Pencil className="w-5 h-5" />
                              </button>
                              <button 
                                title="Delete expense"
                                onClick={() => handleDelete(exp.id)} 
                                className="p-4 text-muted-foreground/20 hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all"
                              >
                               <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {expenses?.length === 0 && (
            <div className="py-32 text-center">
              <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-muted-foreground/20" />
              </div>
              <p className="text-[10px] font-black tracking-widest text-muted-foreground/30 uppercase">No records found</p>
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingExpense(null); resetForm(); }} 
        title={editingExpense ? 'Edit expense' : 'New expense'}
      >
        <form onSubmit={handleSave} className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-full">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Description</label>
              <input required type="text" className="input-field w-full py-4 px-6 text-sm font-black" placeholder="e.g. Electricity bill" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Category</label>
              <select title="Expense category" className="input-field w-full py-4 px-6 text-sm font-black appearance-none bg-background" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Date</label>
              <input title="Expense date" type="date" className="input-field w-full py-4 px-6 text-sm font-black" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-full">
              <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Payment method</label>
              <select title="Payment method" className="input-field w-full py-4 px-6 text-sm font-black appearance-none bg-background" value={formData.paymentMethod} onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}>
                {['Cash', 'Mobile Money', 'Bank Transfer', 'Cheque', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black tracking-widest text-muted-foreground ml-1">Amount (MK)</label>
            <div className="relative group">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-destructive opacity-20 group-focus-within:opacity-100 transition-opacity">MK</span>
              <input 
                title="Expense amount"
                required 
                type="number" 
                className="input-field w-full py-8 pl-20 pr-8 text-4xl font-black text-destructive text-right" 
                placeholder="0.00" 
                value={formData.amount === '' ? '' : formData.amount} 
                onChange={(e) => setFormData({...formData, amount: e.target.value === '' ? '' : parseFloat(e.target.value)})} 
                onFocus={(e) => e.target.select()} 
              />
            </div>
          </div>
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => { setIsModalOpen(false); setEditingExpense(null); resetForm(); }} className="flex-1 py-5 bg-muted/20 border border-border/50 rounded-[1.5rem] text-[10px] font-black tracking-widest uppercase transition-all hover:bg-muted/30">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-5 text-[10px] font-black tracking-widest bg-destructive hover:bg-destructive/90 shadow-xl shadow-destructive/20 uppercase transition-all">Save expense</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!expenseReceipt} onClose={() => setExpenseReceipt(null)} title="Expense voucher">
        {expenseReceipt && (
          <div className="p-10 flex flex-col items-center gap-8">
            <div className="bg-white p-10 w-full rounded-[2rem] shadow-2xl" id="expense-voucher">
              <Receipt {...expenseReceipt} />
            </div>
            <div className="flex gap-4 w-full">
               <button 
                onClick={async () => {
                  const el = document.getElementById('expense-voucher');
                  if (!el) return;
                  toast.loading('Preparing voucher...', { id: 'share' });
                  try {
                    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
                    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                    if (blob) {
                      const file = new File([blob], `voucher-${expenseReceipt.invoiceNo}.png`, { type: 'image/png' });
                      if (navigator.share) {
                        await navigator.share({ files: [file], title: 'Expense voucher', text: `Voucher for ${formData.description}` });
                        toast.success('Shared successfully', { id: 'share' });
                      } else {
                        const text = encodeURIComponent(`Expense voucher\nRef: ${expenseReceipt.invoiceNo}\nAmount: MK ${expenseReceipt.total.toLocaleString()}\nDesc: ${formData.description}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                        toast.success('WhatsApp opened', { id: 'share' });
                      }
                    }
                  } catch { toast.error('Failed to share', { id: 'share' }); }
                }}
                className="flex-1 py-5 bg-emerald-500 text-white rounded-[1.5rem] text-[10px] font-black tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 uppercase"
              >
                <MessageSquare className="w-5 h-5" /> Share WhatsApp
              </button>
              <button type="button" onClick={() => setExpenseReceipt(null)} className="flex-1 py-5 btn-primary font-black text-[10px] tracking-widest uppercase rounded-[1.5rem]">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpensesPage;

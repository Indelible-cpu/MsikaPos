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
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Receipt } from '../components/Receipt';
import html2canvas from 'html2canvas';
import api from '../api/client';

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
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

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

  const handleDelete = (id: string) => {
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-black tracking-wide text-foreground uppercase">Delete this expense record?</span>
        <div className="flex gap-2 justify-end mt-1">
          <button 
            className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                if (!navigator.onLine) {
                  toast.error('You must be online to delete an expense.');
                  return;
                }
                await api.delete(`/expenses/${id}`);
                await db.expenses.delete(id);
                toast.success('Record deleted');
              } catch (e) {
                toast.error('Failed to delete expense online. Try again.');
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleBulkDelete = () => {
    if (selectedExpenseIds.size === 0) return;
    toast((t) => (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-black tracking-wide text-foreground uppercase">Delete {selectedExpenseIds.size} selected expenses?</span>
        <div className="flex gap-2 justify-end mt-1">
          <button 
            className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-muted/50 text-muted-foreground hover:bg-muted/80 transition-colors"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                if (!navigator.onLine) {
                  toast.error('You must be online to bulk delete expenses.');
                  return;
                }
                const deletePromises = Array.from(selectedExpenseIds).map(id => api.delete(`/expenses/${id}`));
                await Promise.all(deletePromises);
                
                await db.expenses.bulkDelete(Array.from(selectedExpenseIds));
                setSelectedExpenseIds(new Set());
                toast.success(`${selectedExpenseIds.size} records deleted`);
              } catch (e) {
                toast.error('Failed to bulk delete online. Try again.');
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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

      <div className="bg-background border-b border-border/50 px-4 md:px-12 py-3 sticky top-0 z-40">
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
          {!readOnly && expenses && expenses.length > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0 px-2 group">
              <input 
                type="checkbox"
                className="w-4 h-4 rounded-md border-border/50 text-primary focus:ring-primary bg-surface-card cursor-pointer"
                checked={selectedExpenseIds.size === expenses.length}
                onChange={(e) => {
                  if (e.target.checked && expenses) {
                    setSelectedExpenseIds(new Set(expenses.map(exp => exp.id)));
                  } else {
                    setSelectedExpenseIds(new Set());
                  }
                }}
              />
              <span className="text-[11px] font-black text-muted-foreground group-hover:text-primary transition-colors uppercase tracking-wider">Select All</span>
            </label>
          )}
          {selectedExpenseIds.size > 0 && !readOnly && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-[11px] font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 shadow-lg shadow-rose-500/20"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete {selectedExpenseIds.size}
            </button>
          )}
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
        <div className="glass-panel rounded-2xl border border-border/50 p-4 flex items-center justify-between shadow-lg max-w-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center shrink-0">
               <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">Total outflow</div>
               <div className="text-xl font-black text-foreground tracking-tighter">MK {totalSpent.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6 pb-20">
          {Object.entries(groupedExpenses).map(([groupName, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupName} className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-[9px] font-black tracking-[0.2em] text-primary uppercase whitespace-nowrap">{groupName}</h3>
                  <div className="h-px bg-primary/10 flex-1" />
                </div>
                <div className="divide-y divide-border/20 border-b border-border/10">
                   {items.map(exp => (
                    <div key={exp.id} className="py-3 px-1 flex justify-between items-center group hover:bg-muted/5 transition-all gap-2">
                       <div className="flex items-center gap-3 flex-1 min-w-0">
                          {!readOnly && (
                            <input 
                              type="checkbox" 
                              checked={selectedExpenseIds.has(exp.id)} 
                              onChange={(e) => {
                                 const next = new Set(selectedExpenseIds);
                                 if (e.target.checked) next.add(exp.id);
                                 else next.delete(exp.id);
                                 setSelectedExpenseIds(next);
                              }}
                              className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
                            />
                          )}
                          <div className="hidden sm:flex w-9 h-9 bg-muted/10 text-muted-foreground/60 rounded-xl items-center justify-center shrink-0">
                             <FileText className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                             <div className="font-bold text-xs md:text-sm tracking-tight text-foreground truncate lowercase first-letter:uppercase">{exp.description || 'No description'}</div>
                             <div className="text-[9px] md:text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span>{exp.category}</span>
                                <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                                <span>{exp.date}</span>
                              </div>
                          </div>
                       </div>
                        <div className="flex items-center gap-3 md:gap-6 shrink-0">
                          <div className="text-right flex flex-col justify-center">
                             <div className="text-sm md:text-base font-black text-destructive tracking-tight">MK {exp.amount.toLocaleString()}</div>
                             <div className="text-[8px] md:text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider">{exp.paymentMethod}</div>
                          </div>
                          {!readOnly && (
                            <div className="flex items-center gap-0.5">
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
                                className="p-1.5 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                               <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                title="Delete expense"
                                onClick={() => handleDelete(exp.id)} 
                                className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                              >
                               <Trash2 className="w-3.5 h-3.5" />
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

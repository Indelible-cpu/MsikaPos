import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalExpense } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Trash2, 
  ArrowDownCircle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

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

  const expenses = useLiveQuery(
    () => db.expenses
      .filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()))
      .reverse()
      .toArray(),
    [searchTerm]
  );

  const totalSpent = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await db.expenses.update(editingExpense.id, { ...formData });
        toast.success('Expense updated');
      } else {
        await db.expenses.add({
          ...formData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          synced: 0
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
             <div className="relative glass-card m-2 rounded-2xl flex items-center">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input 
                   type="text" 
                   placeholder="Search description or category..."
                   className="input-field w-full pl-14 text-sm h-full font-bold shadow-inner bg-transparent border-none"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
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
                       <div className="text-[9px] text-muted-foreground font-black tracking-widest uppercase">{exp.category} • {exp.date}</div>
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
              <input type="date" title="Select Date" aria-label="Select Date" placeholder="Select Date" className="input-field w-full" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
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
    </div>
  );
};

export default ExpensesPage;

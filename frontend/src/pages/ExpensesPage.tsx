import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalExpense } from '../db/posDB';
import { 
  Plus, 
  Search, 
  Trash2, 
  ArrowDownCircle,
  FileText,
  Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const ExpensesPage: React.FC = () => {
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
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 md:px-6 md:py-6 bg-surface-bg/80 backdrop-blur-xl md:border-b border-surface-border sticky top-0 z-30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="hidden md:flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter">Expenses</h1>
            </div>
            <button 
              onClick={() => { resetForm(); setEditingExpense(null); setIsModalOpen(true); }}
              className="btn-primary !px-6 !py-4 text-[10px] font-black  tracking-widest bg-red-500 hover:bg-red-600 shadow-xl shadow-red-900/20 w-full md:w-auto"
            >
              <Plus className="w-4 h-4 mr-2 inline" /> Add expense
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="p-4 border-r border-surface-border/50 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                   <ArrowDownCircle className="w-6 h-6" />
                </div>
                <div>
                   <div className="text-[9px] font-black  tracking-widest text-surface-text/30">Total outflow</div>
                   <div className="text-2xl font-black">MK {totalSpent.toLocaleString()}</div>
                </div>
             </div>
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search description or category..."
                  className="input-field w-full pl-11 text-sm h-full font-bold shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </div>
      </header>

      <div className="p-0 border-t border-surface-border">
        <div className="overflow-hidden divide-y divide-surface-border">
          {expenses?.length === 0 ? (
            <div className="p-20 text-center text-surface-text/20 font-black text-xs  tracking-widest">No expenses recorded</div>
          ) : (
            expenses?.map(exp => (
              <div key={exp.id} className="p-6 flex justify-between items-center group hover:bg-red-500/5 transition-colors">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center text-surface-text/20 group-hover:text-red-500 transition-colors">
                       <FileText className="w-5 h-5" />
                    </div>
                    <div>
                       <div className="font-black text-sm tracking-tight">{exp.description || 'No description'}</div>
                       <div className="text-[10px] text-surface-text/40 font-black  tracking-widest">{exp.category} • {exp.date}</div>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right">
                       <div className="text-base font-black text-red-500">MK {exp.amount.toLocaleString()}</div>
                       <div className="text-[9px] text-surface-text/30 font-black tracking-widest ">{exp.paymentMethod}</div>
                    </div>
                    <button title="Delete" aria-label="Delete expense" onClick={() => handleDelete(exp.id)} className="p-2 text-surface-text/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                       <Trash2 className="w-4 h-4" />
                    </button>
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
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-2xl text-[10px] font-black  tracking-widest">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-black  tracking-widest bg-red-500 hover:bg-red-600 shadow-xl shadow-red-900/20">Save expense</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;

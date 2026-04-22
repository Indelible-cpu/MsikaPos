import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalCustomer } from '../db/posDB';
import { 
  UserPlus, 
  Search, 
  Users, 
  Phone, 
  History,
  ArrowRightCircle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import Modal from '../components/Modal';

const DebtPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');

  // Form State
  const [custForm, setCustForm] = useState({ name: '', phone: '' });

  // Data
  const customers = useLiveQuery(
    () => db.customers.where('name').startsWithIgnoreCase(searchTerm).toArray(),
    [searchTerm]
  );

  const customerSales = useLiveQuery(
    () => selectedCustomer ? db.salesQueue.where('customerId').equals(selectedCustomer.id).reverse().toArray() : [],
    [selectedCustomer]
  );

  const customerPayments = useLiveQuery(
    () => selectedCustomer ? db.debtPayments.where('customerId').equals(selectedCustomer.id).reverse().toArray() : [],
    [selectedCustomer]
  );

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) return;

    try {
      await db.customers.add({
        id: crypto.randomUUID(),
        name: custForm.name,
        phone: custForm.phone,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Customer added successfully');
      setIsAddModalOpen(false);
      setCustForm({ name: '', phone: '' });
    } catch {
      toast.error('Failed to add customer');
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    const amount = parseFloat(paymentAmount);
    try {
      await db.debtPayments.add({
        id: crypto.randomUUID(),
        customerId: selectedCustomer.id,
        amount,
        paymentMethod: 'CASH',
        createdAt: new Date().toISOString(),
      });

      await db.customers.update(selectedCustomer.id, {
        balance: selectedCustomer.balance - amount,
        updatedAt: new Date().toISOString()
      });

      setSelectedCustomer({
        ...selectedCustomer,
        balance: selectedCustomer.balance - amount
      });

      toast.success(`Payment recorded`);
      setPaymentAmount('');
    } catch {
      toast.error('Failed to record payment');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="p-6 bg-surface-card border-b border-surface-border sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Debt Records</h1>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary !px-4 !py-2 text-[10px] font-black uppercase tracking-widest"
          >
            Add Customer
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search customers..."
            className="input-field w-full pl-11 text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {customers?.map(customer => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="bg-surface-card border border-surface-border rounded-2xl p-5 group hover:border-primary-500/30 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-surface-bg rounded-xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/30 transition-colors">
                  <UserPlus className="w-6 h-6 text-surface-text/40 group-hover:text-primary-400" />
                </div>
                {customer.balance > 0 && (
                  <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border border-amber-500/20 flex items-center gap-1">
                    <AlertCircle className="w-2.5 h-2.5" /> Owing
                  </div>
                )}
              </div>
              
              <h3 className="font-bold text-lg leading-tight uppercase tracking-tight mb-1 group-hover:text-primary-400 transition-colors">{customer.name}</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-surface-text/30 mb-6 uppercase tracking-wider">
                <Phone className="w-3 h-3" /> {customer.phone}
              </div>

              <div className="pt-4 border-t border-surface-border flex justify-between items-end">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-surface-text/20 mb-1">Balance</div>
                  <div className={clsx(
                    "text-lg font-black",
                    customer.balance > 0 ? "text-amber-500" : "text-emerald-500"
                  )}>
                    MK {customer.balance.toLocaleString()}
                  </div>
                </div>
                <ArrowRightCircle className="w-5 h-5 text-surface-text/20 group-hover:text-primary-400 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Customer Details Modal */}
      <Modal 
        isOpen={!!selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        title={selectedCustomer?.name || ''}
        maxWidth="max-w-2xl"
      >
        {selectedCustomer && (
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-bg/50 p-6 rounded-2xl border border-surface-border">
                <div className="text-[10px] font-black uppercase tracking-widest text-surface-text/30">Total Balance</div>
                <div className="text-3xl font-black text-amber-500 mt-2">MK {selectedCustomer.balance.toLocaleString()}</div>
              </div>
              <div className="bg-surface-bg/50 p-6 rounded-2xl border border-surface-border">
                <div className="text-[10px] font-black uppercase tracking-widest text-surface-text/30">Record Payment</div>
                <div className="flex gap-2 mt-2">
                  <input type="number" placeholder="Amount" className="input-field flex-1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <button onClick={handleRecordPayment} className="btn-primary !px-4 !py-2 text-[10px] font-black uppercase tracking-widest">Record</button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-surface-text/30 flex items-center gap-2">
                <History className="w-4 h-4" /> Recent Transactions
              </h3>
              <div className="bg-surface-border/20 rounded-2xl overflow-hidden border border-surface-border divide-y divide-surface-border">
                {customerSales?.length === 0 && customerPayments?.length === 0 && (
                  <div className="p-12 text-center text-surface-text/20 font-black uppercase text-[10px] tracking-widest">No transaction history</div>
                )}
                {customerSales?.map(sale => (
                  <div key={sale.id} className="p-4 bg-surface-card flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <div>
                      <div className="text-xs font-black uppercase">Sale #{sale.id.slice(0,8)}</div>
                      <div className="text-[9px] text-surface-text/30 font-bold uppercase">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-red-500">- MK {sale.total.toLocaleString()}</div>
                      <div className="text-[8px] text-surface-text/20 font-black uppercase">Debt Incurred</div>
                    </div>
                  </div>
                ))}
                {customerPayments?.map(payment => (
                  <div key={payment.id} className="p-4 bg-surface-card flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <div>
                      <div className="text-xs font-black text-emerald-500 uppercase">Payment Received</div>
                      <div className="text-[9px] text-surface-text/30 font-bold uppercase">{format(new Date(payment.createdAt), 'MMM dd, HH:mm')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-500">+ MK {payment.amount.toLocaleString()}</div>
                      <div className="text-[8px] text-surface-text/20 font-black uppercase">{payment.paymentMethod}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Customer Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="New Customer"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 pl-1">Full Name</label>
            <input required type="text" className="input-field w-full" placeholder="e.g. John Phiri" value={custForm.name} onChange={(e) => setCustForm({...custForm, name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-surface-text/30 pl-1">Phone Number</label>
            <input required type="text" className="input-field w-full" placeholder="e.g. +265 88..." value={custForm.phone} onChange={(e) => setCustForm({...custForm, phone: e.target.value})} />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-surface-bg border border-surface-border rounded-xl text-[10px] font-bold uppercase">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-3 text-[10px] font-black uppercase tracking-widest">Create Profile</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DebtPage;

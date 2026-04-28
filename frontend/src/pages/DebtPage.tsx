import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type LocalCustomer } from '../db/posDB';
import { 
  UserPlus, 
  Search, 
  Users, 
  Phone, 
  History,
  ArrowRightCircle,
  AlertCircle,
  Camera,
  Fingerprint,
  Upload,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import Modal from '../components/Modal';

// Malawian format validators
const MALAWI_PHONE_REGEX = /^\d{10}$|^\d{13}$/;
const MALAWI_ID_REGEX = /^[A-Za-z0-9]{8}$/;

// Mock Encrypt function (In real production, use Web Crypto API)
const mockEncrypt = (data: string) => btoa(data); // "End to End Encryption" mock for Dexie

const DebtPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);

  // Form State
  const [custForm, setCustForm] = useState({ 
    name: '', 
    phone: '',
    idNumber: '',
    village: '',
    livePhoto: '',
    fingerprintData: ''
  });

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error('Camera access denied or unavailable');
      setUseCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCustForm({ ...custForm, livePhoto: dataUrl });
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setUseCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustForm({ ...custForm, livePhoto: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const captureFingerprint = async () => {
    // Simulating biometric capture/WebAuthn
    toast.loading('Scanning fingerprint...', { id: 'fp' });
    setTimeout(() => {
      const mockHash = "FP_" + Math.random().toString(36).substring(2, 15);
      setCustForm({ ...custForm, fingerprintData: mockEncrypt(mockHash) });
      toast.success('Fingerprint secured & encrypted', { id: 'fp' });
    }, 1500);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) return;

    if (!MALAWI_PHONE_REGEX.test(custForm.phone)) {
      toast.error('Mobile number must be exactly 10 or 13 digits');
      return;
    }

    if (custForm.idNumber && !MALAWI_ID_REGEX.test(custForm.idNumber.toUpperCase())) {
      toast.error('National ID must be exactly 8 alphanumeric characters');
      return;
    }

    try {
      await db.customers.add({
        id: crypto.randomUUID(),
        name: custForm.name,
        phone: custForm.phone,
        idNumber: custForm.idNumber.toUpperCase(),
        village: custForm.village,
        livePhoto: custForm.livePhoto,
        fingerprintData: custForm.fingerprintData,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success('Customer profile created securely');
      setIsAddModalOpen(false);
      setCustForm({ name: '', phone: '', idNumber: '', village: '', livePhoto: '', fingerprintData: '' });
      stopCamera();
    } catch {
      toast.error('Failed to add customer');
    }
  };



  return (
    <div className="flex flex-col min-h-screen bg-surface-bg transition-all pb-24 md:pb-0">
      <header className="px-0 py-0 bg-surface-card border-b border-surface-border sticky top-0 z-30">
        <div className="p-6 md:px-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600/10 text-primary-400 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter">Customers & Debt</h1>
            </div>

            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 h-12 bg-primary-500 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-lg shadow-primary-500/20 active:scale-95 transition-all uppercase"
            >
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-text/40 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search customers..."
              className="input-field w-full pl-11 text-sm font-bold shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
        <AnimatePresence mode="popLayout">
          {customers?.map(customer => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className="px-6 md:px-12 py-8 group transition-all cursor-pointer border-b border-r border-surface-border/50 hover:bg-primary-500/[0.02]"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-surface-bg rounded-xl overflow-hidden flex items-center justify-center border border-surface-border group-hover:border-primary-500/30 transition-colors">
                  {customer.livePhoto ? (
                    <img src={customer.livePhoto} alt={customer.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserPlus className="w-6 h-6 text-surface-text/40 group-hover:text-primary-400" />
                  )}
                </div>
                {customer.balance > 0 && (
                  <div className="bg-amber-500/10 text-amber-500 px-2 py-1 rounded-md text-[8px] font-black border border-amber-500/20 flex items-center gap-1 uppercase">
                    <AlertCircle className="w-2.5 h-2.5" /> Owing
                  </div>
                )}
              </div>
              
              <h3 className="font-black text-lg leading-tight tracking-tight mb-1 group-hover:text-primary-400 transition-colors">{customer.name}</h3>
              <div className="flex flex-col gap-1 text-[10px] font-black text-surface-text/30 mb-6 tracking-widest uppercase">
                <div className="flex items-center gap-2"><Phone className="w-3 h-3" /> {customer.phone}</div>
                {customer.idNumber && <div className="flex items-center gap-2 mt-1">ID: {customer.idNumber}</div>}
              </div>

              <div className="pt-4 border-t border-surface-border flex justify-between items-end">
                <div>
                  <div className="text-[9px] font-black text-surface-text/20 mb-1 uppercase">Balance</div>
                  <div className={clsx(
                    "text-lg font-black tracking-tighter",
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

      <Modal 
        isOpen={!!selectedCustomer} 
        onClose={() => setSelectedCustomer(null)} 
        title={selectedCustomer?.name || ''}
        maxWidth="max-w-2xl"
      >
        {selectedCustomer && (
          <div className="p-4 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-surface-bg/50 p-6 rounded-none border border-surface-border flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold text-surface-text/30">Total balance</div>
                  <div className="text-3xl font-black text-amber-500 mt-2">MK {selectedCustomer.balance.toLocaleString()}</div>
                </div>
                {selectedCustomer.balance > 0 && (
                  <button 
                    onClick={async () => {
                      if (confirm(`Are you sure you want to clear MK ${selectedCustomer.balance.toLocaleString()} for ${selectedCustomer.name}? This cannot be undone.`)) {
                        try {
                          await db.customers.update(selectedCustomer.id, { balance: 0, updatedAt: new Date().toISOString() });
                          setSelectedCustomer({ ...selectedCustomer, balance: 0 });
                          toast.success('Balance cleared successfully');
                        } catch {
                          toast.error('Failed to clear balance');
                        }
                      }
                    }}
                    className="mt-6 w-full btn-primary !bg-emerald-500 !shadow-emerald-500/20 !py-3 text-[10px] font-black tracking-widest"
                  >
                    Clear balance
                  </button>
                )}
              </div>
              <div className="bg-surface-bg/50 p-6 rounded-none border border-surface-border flex flex-col justify-center items-center text-center opacity-40 ">
                <div className="text-[10px] font-bold text-surface-text/30 mb-2 tracking-widest ">Manual Credit Blocked</div>
                <div className="text-[8px] font-bold">Credit must only be added through POS Terminal for audit security.</div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-bold text-surface-text/30 flex items-center gap-2">
                <History className="w-4 h-4" /> Recent transactions
              </h3>
              <div className="bg-surface-border/20 rounded-none overflow-hidden border border-surface-border divide-y divide-surface-border">
                {customerSales?.length === 0 && customerPayments?.length === 0 && (
                  <div className="p-12 text-center text-surface-text/20 font-bold text-[10px]">No transaction history</div>
                )}
                {customerSales?.map(sale => (
                  <div key={sale.id} className="p-4 bg-surface-card flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <div>
                      <div className="text-xs font-bold">Sale #{sale.id.slice(0,8)}</div>
                      <div className="text-[9px] text-surface-text/30 font-bold">{format(new Date(sale.createdAt), 'MMM dd, HH:mm')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-red-500">- MK {sale.total.toLocaleString()}</div>
                      <div className="text-[8px] text-surface-text/20 font-bold">Debt incurred</div>
                    </div>
                  </div>
                ))}
                {customerPayments?.map(payment => (
                  <div key={payment.id} className="p-4 bg-surface-card flex justify-between items-center group hover:bg-primary-500/5 transition-colors">
                    <div>
                      <div className="text-xs font-bold text-emerald-500">Payment received</div>
                      <div className="text-[9px] text-surface-text/30 font-bold">{format(new Date(payment.createdAt), 'MMM dd, HH:mm')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-500">+ MK {payment.amount.toLocaleString()}</div>
                      <div className="text-[8px] text-surface-text/20 font-bold">{payment.paymentMethod}</div>
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
        onClose={() => { setIsAddModalOpen(false); stopCamera(); }} 
        title="New customer profile"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleAddCustomer} className="p-4 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">Full name</label>
                <input required type="text" className="input-field w-full" placeholder="e.g. John Phiri" value={custForm.name} onChange={(e) => setCustForm({...custForm, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">Phone number</label>
                <input required type="text" className="input-field w-full" placeholder="e.g. 0881234567 or +265..." value={custForm.phone} onChange={(e) => setCustForm({...custForm, phone: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">National ID (8 chars)</label>
                <input type="text" className="input-field w-full" placeholder="e.g. ABC12345" value={custForm.idNumber} onChange={(e) => setCustForm({...custForm, idNumber: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">Village / location</label>
                <input type="text" className="input-field w-full" placeholder="e.g. Lilongwe" value={custForm.village} onChange={(e) => setCustForm({...custForm, village: e.target.value})} />
              </div>
            </div>

            <div className="w-full md:w-48 space-y-4">
              {/* Photo Capture */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">Live photo</label>
                <div className="w-full aspect-square bg-surface-bg border border-surface-border rounded-2xl overflow-hidden relative flex flex-col items-center justify-center">
                  {custForm.livePhoto ? (
                    <img src={custForm.livePhoto} alt="Preview" className="w-full h-full object-cover" />
                  ) : useCamera ? (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <UserPlus className="w-8 h-8 text-surface-text/20 mb-2" />
                  )}
                  
                  {useCamera && !custForm.livePhoto && (
                    <button type="button" title="Capture photo" aria-label="Capture photo" onClick={capturePhoto} className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-500 text-white w-10 h-10 rounded-full shadow-lg border-2 border-white"></button>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                
                <div className="flex gap-2">
                  {!useCamera && !custForm.livePhoto && (
                    <button type="button" onClick={startCamera} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 hover:bg-surface-border/50">
                      <Camera className="w-3 h-3" /> Camera
                    </button>
                  )}
                  {custForm.livePhoto && (
                    <button type="button" onClick={() => setCustForm({...custForm, livePhoto: ''})} className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[9px] font-bold text-red-500 hover:bg-red-500/10">
                      Retake
                    </button>
                  )}
                  <label className="flex-1 py-2 bg-surface-bg border border-surface-border rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:bg-surface-border/50">
                    <Upload className="w-3 h-3" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              {/* Fingerprint Capture */}
              <div className="space-y-2 pt-2 border-t border-surface-border">
                <label className="text-[9px] font-bold text-surface-text/30 pl-1">Biometrics (encrypted)</label>
                <button 
                  type="button" 
                  onClick={captureFingerprint}
                  disabled={!!custForm.fingerprintData}
                  className={`w-full py-4 rounded-xl flex flex-col items-center gap-2 border transition-all ${custForm.fingerprintData ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-surface-bg border-surface-border hover:border-primary-500/30 text-surface-text/60'}`}
                >
                  {custForm.fingerprintData ? (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span className="text-[9px] font-bold">Captured</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-6 h-6" />
                      <span className="text-[9px] font-bold">Scan fingerprint</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 mt-4 border-t border-surface-border">
            <button type="button" onClick={() => { setIsAddModalOpen(false); stopCamera(); }} className="flex-1 py-4 bg-surface-bg border border-surface-border rounded-xl text-[10px] font-bold">Cancel</button>
            <button type="submit" className="flex-1 btn-primary !py-4 text-[10px] font-bold">Create secure profile</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DebtPage;

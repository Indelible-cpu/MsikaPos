import React from 'react';
import { User, Store, Building2, ShieldAlert, History, TrendingUp, Wallet, Video, X, Lock, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/posDB';
import { AuditService } from '../services/AuditService';
import api from '../api/client';
import { restrictPhone } from '../utils/phoneUtils';
import { SyncService } from '../services/SyncService';
import Modal from '../components/Modal';
import BrandName from '../components/BrandName';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [confirmModal, setConfirmModal] = React.useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [lockTime, setLockTime] = React.useState('20:00');
  const [unlockTime, setUnlockTime] = React.useState('06:00');
  const [taxRate, setTaxRate] = React.useState<number | ''>(0);
  const [taxInclusive, setTaxInclusive] = React.useState(true);
  const [companyName, setCompanyName] = React.useState('');
  const [slogan, setSlogan] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [companyPhone, setCompanyPhone] = React.useState('');
  const [companyEmail, setCompanyEmail] = React.useState('');
  const [primaryColor, setPrimaryColor] = React.useState('#6366f1');
  const [currency, setCurrency] = React.useState('MK');
  const [momoProvider, setMomoProvider] = React.useState('TNM Mpamba, Airtel Money');
  const [bankNameSetting, setBankNameSetting] = React.useState('National Bank, NBS Bank, Standard Bank');
  const [fontSize, setFontSize] = React.useState('medium');
  const [facebookPage, setFacebookPage] = React.useState('');

  const handleResetTransactions = async () => {
    setConfirmModal({
      title: 'Reset all transactions?',
      message: 'This will permanently delete all sales, expenses, and debt records. This cannot be undone.',
      onConfirm: async () => {
        toast.loading('Wiping transaction records...', { id: 'reset-tx' });
        try {
          await db.salesQueue.clear();
          await db.expenses.clear();
          await db.debtPayments.clear();
          await db.customers.toCollection().modify({ balance: 0, totalCreditAmount: 0, totalPaidAmount: 0 });
          toast.success('All transactions wiped clean.', { id: 'reset-tx' });
          setConfirmModal(null);
        } catch {
          toast.error('Wipe failed.', { id: 'reset-tx' });
        }
      }
    });
  };

  const handleResetSettings = async () => {
    setConfirmModal({
      title: 'Reset system settings?',
      message: 'This will revert all branding, tax, and system preferences to defaults.',
      onConfirm: async () => {
        toast.loading('Resetting system preferences...', { id: 'reset-st' });
        try {
          await db.settings.clear();
          localStorage.removeItem('companyLogo');
          localStorage.removeItem('companyName');
          toast.success('System settings restored to defaults.', { id: 'reset-st' });
          setConfirmModal(null);
          setTimeout(() => window.location.reload(), 1000);
        } catch {
          toast.error('Reset failed.', { id: 'reset-st' });
        }
      }
    });
  };

  const saveBrandingConfig = async () => {
    if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      return toast.error("Please enter a valid working company email address");
    }
    toast.loading('Saving branding...', { id: 'save-brand' });
    try {
      await api.post('/settings', {
        companyName,
        slogan,
        address,
        phone: companyPhone,
        email: companyEmail,
        facebook: facebookPage,
        primaryColor,
        currency
      });
      localStorage.setItem('companyName', companyName);
      localStorage.setItem('currency', currency);
      localStorage.setItem('companyFacebook', facebookPage);
      toast.success('Branding updated', { id: 'save-brand' });
    } catch {
      toast.error('Failed to save branding', { id: 'save-brand' });
    }
  };

  const savePaymentConfig = async () => {
    toast.loading('Saving payments...', { id: 'save-pay' });
    try {
      await db.settings.put({ key: 'payment_config', value: { momo: momoProvider, bank: bankNameSetting } });
      toast.success('Payment configuration saved', { id: 'save-pay' });
    } catch {
      toast.error('Failed to save payments', { id: 'save-pay' });
    }
  };

  const saveTaxConfig = async () => {
    toast.loading('Saving tax settings...', { id: 'save-tax' });
    try {
      const config = { rate: taxRate, inclusive: taxInclusive };
      await db.settings.put({ key: 'tax_config', value: config });
      toast.success('Tax configuration saved', { id: 'save-tax' });
    } catch {
      toast.error('Failed to save tax config', { id: 'save-tax' });
    }
  };

  const saveHours = async () => {
    toast.loading('Saving hours...', { id: 'save-hours' });
    try {
      await db.settings.put({ key: 'lockout_hours', value: { start: lockTime, end: unlockTime } });
      toast.success('Hours updated', { id: 'save-hours' });
    } catch {
      toast.error('Failed to save hours', { id: 'save-hours' });
    }
  };

  const toggleSystemLock = async (locked: boolean) => {
    try {
      await db.settings.put({ key: 'system_lock', value: locked });
      await AuditService.log(locked ? 'SYSTEM_LOCKED' : 'SYSTEM_UNLOCKED', `System manually ${locked ? 'locked' : 'unlocked'} by ${user.username}`);
      toast.success(`System ${locked ? 'locked' : 'unlocked'}`);
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error('Failed to update system lock');
    }
  };

  React.useEffect(() => {
    const loadSettings = async () => {
      const hours = await db.settings.get('lockout_hours');
      if (hours?.value) {
        const val = hours.value as { start: string; end: string };
        setLockTime(val.start);
        setUnlockTime(val.end);
      }
      const tax = await db.settings.get('tax_config');
      if (tax?.value) {
        const val = tax.value as { rate: number; inclusive: boolean };
        setTaxRate(val.rate);
        setTaxInclusive(val.inclusive);
      }
      try {
        const res = await api.get('/public/settings');
        if (res.data.success && res.data.data) {
          const s = res.data.data;
          setCompanyName(s.companyName || '');
          setSlogan(s.slogan || '');
          setAddress(s.address || '');
          setCompanyPhone(s.phone || '');
          setCompanyEmail(s.email || '');
          setFacebookPage(s.facebook || '');
          setPrimaryColor(s.primaryColor || '#6366f1');
          setCurrency(s.currency || 'MK');
          localStorage.setItem('companyName', s.companyName || '');
          localStorage.setItem('companyAddress', s.address || '');
          localStorage.setItem('companyPhone', s.phone || '');
          localStorage.setItem('companyEmail', s.email || '');
          localStorage.setItem('companyFacebook', s.facebook || '');
          localStorage.setItem('companySlogan', s.slogan || '');
        }
      } catch { /* Silent fail */ }

      const payment = await db.settings.get('payment_config');
      if (payment?.value) {
        const val = payment.value as { momo: string; bank: string };
        setMomoProvider(val.momo || 'TNM Mpamba, Airtel Money');
        setBankNameSetting(val.bank || 'National Bank, NBS Bank, Standard Bank');
      }

      const storedFontSize = localStorage.getItem('fontSize') || 'medium';
      setFontSize(storedFontSize);
    };
    loadSettings();
  }, []);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL('image/jpeg');
        updateProfilePic(base64);
      }
    }
  };

  const updateProfilePic = async (base64: string) => {
    try {
      localStorage.setItem('userPhoto', base64);
      const updatedUser = { ...user, profilePic: base64 };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      await api.put(`/users/${user.id}`, { profilePic: base64 });
      toast.success('Profile photo updated');
      stopCamera();
      window.dispatchEvent(new Event('storage'));
      setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error('Failed to update profile photo');
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error('Could not access camera');
      setIsCameraOpen(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background transition-all pb-24 md:pb-0 px-0">
      

      <div className="w-full px-0 py-0 space-y-px">
        {/* Profile Section */}
        <div className="flex flex-col md:flex-row items-center gap-8 p-6 md:p-12 glass-panel border-b border-border/50 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-2xl bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
              {localStorage.getItem('userPhoto') || user.profilePic ? (
                <img src={localStorage.getItem('userPhoto') || user.profilePic} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 flex gap-2">
              <label title="Upload Profile Photo" className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer btn-press">
                <Video className="w-4 h-4" />
                <input
                  title="Choose Profile Image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => updateProfilePic(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              <button
                title="Start Camera"
                onClick={startCamera}
                className="p-3 bg-emerald-500 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all btn-press"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-center md:text-left flex-1 relative">
            <h2 className="text-3xl font-black tracking-tighter">{user.fullname || user.username || 'Employee'}</h2>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-none text-[10px] font-black tracking-widest border border-primary/20 uppercase">Role: {user.role || 'Staff'}</span>
              <span className="px-4 py-1.5 bg-success/10 text-success rounded-none text-[10px] font-black tracking-widest border border-success/20">Online status</span>
            </div>
          </div>
        </div>

        <div className="space-y-px stagger-children">
          <div className="glass-panel border-b border-border/50 overflow-hidden">
            <div className="px-6 md:px-12 py-5 bg-muted/30 border-b border-border/50">
              <div className="text-[10px] font-black text-primary uppercase tracking-widest">System preferences</div>
            </div>

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 border-b border-border/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 flex items-center justify-center shrink-0 bg-background border border-border rounded-full overflow-hidden shadow-inner">
                    {localStorage.getItem('companyLogo') ? (
                      <img src={localStorage.getItem('companyLogo')!} alt="Company logo" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-8 h-8 text-foreground/10" />
                    )}
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Upload logo</div>
                    <div className="text-xs text-muted-foreground font-bold">Recommended size: 512x512px</div>
                  </div>
                </div>
                <label title="Choose Logo File" className="btn-primary btn-press hover-lift !px-8 !py-4 text-[11px] font-black tracking-widest cursor-pointer w-full md:w-auto text-center shadow-xl shadow-primary/20 rounded-2xl">
                  Choose file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          localStorage.setItem('companyLogo', base64);
                          try {
                            await api.post('/settings', { logo: base64 });
                            toast.success('Logo updated');
                            window.dispatchEvent(new Event('storage'));
                            setTimeout(() => window.location.reload(), 500);
                          } catch {
                            toast.error('Failed to save logo');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    title="Upload Logo"
                  />
                </label>
              </div>
            )}

            <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary/5 transition-colors border-b border-border/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-background rounded-2xl flex items-center justify-center border border-border group-hover:border-primary/20 transition-all">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-black text-sm tracking-tight">Font size</div>
                  <div className="text-xs text-muted-foreground font-bold">Adjust the system typography scale</div>
                </div>
              </div>
              <div className="flex gap-2 p-1 bg-background border border-border rounded-2xl w-full md:w-fit">
                {['small', 'medium', 'large'].map((size) => {
                  const isSelected = fontSize === size;
                  return (
                    <button
                      key={size}
                      onClick={() => {
                        setFontSize(size);
                        localStorage.setItem('fontSize', size);
                        document.documentElement.setAttribute('data-font-size', size);
                        toast.success(`Font size set to ${size}`);
                      }}
                      className={clsx(
                        "px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all flex-1 md:flex-none btn-press",
                        isSelected ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 flex flex-col gap-10 group hover:bg-primary/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-background rounded-2xl flex items-center justify-center border border-border group-hover:border-primary/20 transition-all">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Company info</div>
                    <div className="text-xs text-muted-foreground font-bold">Configure your system-wide brand identity</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Shop name</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                        placeholder="e.g. MsikaPos Cloud"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Slogan / motto</label>
                      <input
                        type="text"
                        value={slogan}
                        onChange={(e) => setSlogan(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                        placeholder="e.g. Your Business, Simplified"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Business address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner min-h-[100px]"
                        placeholder="Enter physical address..."
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Phone</label>
                        <input
                          title="Company phone number"
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(restrictPhone(e.target.value))}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                          placeholder="+265..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Email</label>
                        <input
                          title="Company email address"
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                          placeholder="info@msikapos.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Facebook page</label>
                      <input
                        title="Facebook page link"
                        type="text"
                        value={facebookPage}
                        onChange={(e) => setFacebookPage(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                        placeholder="e.g. facebook.com/msikapos"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">System theme color</label>
                        <div className="flex items-center gap-3">
                          <input
                            title="Primary system color"
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-12 h-12 rounded-xl border border-border bg-background cursor-pointer p-1"
                          />
                          <input
                            title="Primary color hex code"
                            type="text"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="input-field flex-1 py-3 px-4 text-xs font-black shadow-inner"
                            placeholder="#6366f1"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Base currency</label>
                        <select
                          title="System base currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner appearance-none bg-background"
                        >
                          <option value="MK">MK - Malawi Kwacha</option>
                          <option value="$">USD - Dollar ($)</option>
                          <option value="ZAR">ZAR - Rand</option>
                          <option value="£">GBP - Pound (£)</option>
                          <option value="€">EUR - Euro (€)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button onClick={saveBrandingConfig} className="h-14 btn-primary w-full text-[11px] font-black tracking-widest shadow-xl shadow-primary/20 rounded-2xl">
                        Save brand identity
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-background rounded-2xl flex items-center justify-center border border-border group-hover:border-primary/20 transition-all">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Payment methods</div>
                    <div className="text-xs text-muted-foreground font-bold">Configure mobile money and bank names</div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-4 mt-2">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Momo provider</label>
                    <input
                      type="text"
                      value={momoProvider}
                      onChange={(e) => setMomoProvider(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="e.g. TNM Mpamba, Airtel Money"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Bank name</label>
                    <input
                      type="text"
                      value={bankNameSetting}
                      onChange={(e) => setBankNameSetting(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="e.g. National Bank, NBS Bank, Standard Bank"
                    />
                  </div>
                  <div className="w-full md:w-auto">
                  <button onClick={savePaymentConfig} className="h-14 btn-primary !px-8 text-[11px] font-black tracking-widest w-full md:w-auto shadow-xl shadow-primary/20 rounded-2xl shrink-0">
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-background rounded-2xl flex items-center justify-center border border-border group-hover:border-primary/20 transition-all">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Tax settings</div>
                    <div className="text-xs text-muted-foreground font-bold">Configure default tax rate for all products</div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-4 mt-2">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Tax rate (%)</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-primary-500 opacity-40 group-focus-within:opacity-100 transition-opacity">%</span>
                      <input
                        title="Tax rate percentage"
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="input-field w-full py-3 pl-10 pr-4 text-sm font-black shadow-inner"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex-1 w-full flex items-center gap-4 py-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxInclusive}
                        onChange={(e) => setTaxInclusive(e.target.checked)}
                        className="w-5 h-5 rounded border-border"
                      />
                      <span className="text-sm font-black tracking-tight">Tax inclusive pricing</span>
                    </label>
                  </div>
                  <div className="w-full md:w-auto">
                  <button onClick={saveTaxConfig} className="h-14 btn-primary !px-8 text-[11px] font-black tracking-widest w-full md:w-auto shadow-xl shadow-primary/20 rounded-2xl shrink-0">
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="glass-panel border-b border-border/50 overflow-hidden">
              <div className="px-6 md:px-12 py-5 bg-red-500/5 border-b border-border/50">
                <h3 className="text-[10px] font-black text-red-500 tracking-widest uppercase">System security & control</h3>
              </div>

              <div className="px-6 md:px-12 py-8 border-b border-border/30 flex items-center justify-between group hover:bg-red-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 group-hover:border-red-500 transition-all">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Force system lock</div>
                    <div className="text-xs text-muted-foreground font-bold">Immediately restrict access for all non-admin users</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleSystemLock(true)}
                  className="h-14 px-8 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl shadow-red-500/30 transition-all btn-press shrink-0"
                >
                  Lock now
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 flex items-center justify-between group hover:bg-primary/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:border-primary transition-all">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Module permissions</div>
                    <div className="text-xs text-muted-foreground font-bold">Configure what Admins and Cashiers can see and do</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/staff/feature-access')}
                  className="h-14 px-8 btn-primary text-[11px] font-black tracking-widest shadow-xl shadow-primary/20 rounded-2xl shrink-0"
                >
                  Manage
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 border-b border-border/30 flex flex-col gap-4 group hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-background rounded-2xl flex items-center justify-center border border-border group-hover:border-primary/20 transition-all">
                    <History className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Working hours auto-lock</div>
                    <div className="text-xs text-muted-foreground font-bold">Access is restricted daily during these off hours</div>
                  </div>
                </div>
                <div className="flex items-end gap-4 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Lock time</label>
                    <input
                      title="Lockout start time"
                      type="time"
                      value={lockTime}
                      onChange={(e) => setLockTime(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-muted-foreground ml-1 tracking-widest">Unlock time</label>
                    <input
                      title="Lockout end time"
                      type="time"
                      value={unlockTime}
                      onChange={(e) => setUnlockTime(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                    />
                  </div>
                  <div className="w-full md:w-auto">
                  <button onClick={saveHours} className="h-14 btn-primary !px-8 text-[11px] font-black tracking-widest rounded-2xl shadow-xl shadow-primary/20 shrink-0">
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 md:px-12 py-8 flex items-center justify-between group hover:bg-red-500/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 group-hover:border-red-500 transition-all">
                    <History className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight text-red-500">Force system data reset</div>
                    <div className="text-xs text-muted-foreground font-bold">Wipes local cache and re-downloads all data from the cloud.</div>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setConfirmModal({
                      title: 'Reset local cache?',
                      message: 'This will re-download all data from the cloud. Unsynced changes will be pushed first.',
                      onConfirm: async () => {
                        toast.loading('Finalizing sync before reset...', { id: 'reset' });
                        const syncSuccess = await SyncService.pushSales();
                        
                        if (!syncSuccess) {
                          toast.error('Sync failed. Please check connection before resetting.', { id: 'reset' });
                          setConfirmModal(null);
                          return;
                        }

                        localStorage.removeItem('lastSyncTimestamp');
                        await db.products.clear();
                        await db.customers.clear();
                        await db.expenses.clear();
                        await db.salesQueue.where('synced').equals(1).delete();
                        toast.success('Local cache cleared. Reloading...', { id: 'reset' });
                        setConfirmModal(null);
                        setTimeout(() => window.location.reload(), 1500);
                      }
                    });
                  }}
                  className="h-14 px-8 bg-zinc-900 hover:bg-black text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl transition-all btn-press shrink-0"
                >
                  Reset data
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 flex items-center justify-between group hover:bg-rose-500/5 transition-colors border-b border-border/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20 group-hover:border-rose-500 transition-all">
                    <DollarSign className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight text-rose-500">Reset transaction records</div>
                    <div className="text-xs text-muted-foreground font-bold">Deletes all sales, expenses, and customer debt balances.</div>
                  </div>
                </div>
                <button
                  onClick={handleResetTransactions}
                  className="h-14 px-8 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl shadow-rose-500/20 transition-all btn-press shrink-0"
                >
                  Reset transactions
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 flex items-center justify-between group hover:bg-amber-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 group-hover:border-amber-500 transition-all">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight text-amber-500">Reset system settings</div>
                    <div className="text-xs text-muted-foreground font-bold">Wipes branding, tax, and system preferences to defaults.</div>
                  </div>
                </div>
                <button
                  onClick={handleResetSettings}
                  className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl shadow-amber-500/20 transition-all btn-press shrink-0"
                >
                  Reset settings
                </button>
              </div>
            </div>
          )}

          <div className="mt-12 text-center pb-8 border-t border-surface-border/50 pt-8">
            <p className="text-[10px] font-black text-surface-text/20 tracking-[0.3em] mb-4">System information</p>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[10px] font-bold text-surface-text/60 tracking-widest">Product: <BrandName /></p>
              <p className="text-[10px] font-bold text-surface-text/60 tracking-widest">Version: 2.1.0</p>
              <p className="text-[10px] font-bold text-surface-text/60 tracking-widest">Developer: Indelible Technologies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-surface-card rounded-[2.5rem] overflow-hidden border border-surface-border shadow-2xl relative">
            <button
              title="Close camera"
              onClick={stopCamera}
              className="absolute top-6 right-6 z-10 w-10 h-10 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-square bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="p-8 flex flex-col gap-4">
              <button onClick={capturePhoto} className="btn-primary w-full !py-5 text-xs font-black tracking-widest shadow-xl shadow-primary-500/20">
                Capture & set profile photo
              </button>
              <button onClick={stopCamera} className="w-full py-4 text-surface-text/40 text-[10px] font-black tracking-widest hover:text-surface-text transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Themed Confirmation Modal */}
      <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title="Security confirmation">
        <div className="p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter mb-2">{confirmModal?.title}</h2>
            <p className="text-[10px] font-black tracking-widest text-surface-text/40 leading-relaxed">{confirmModal?.message}</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-muted/10 border border-border/50 rounded-2xl text-[10px] font-black tracking-widest uppercase btn-press">Cancel</button>
            <button onClick={confirmModal?.onConfirm} className="flex-1 btn-primary !bg-destructive !py-4 text-[10px] font-black tracking-widest uppercase shadow-xl shadow-destructive/20 btn-press">Confirm reset</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;

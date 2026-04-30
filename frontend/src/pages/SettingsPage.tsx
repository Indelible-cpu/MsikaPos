import React from 'react';
import { User, Store, Smartphone, Building2, ShieldAlert, History, TrendingUp, Plus, Wallet, Video, X, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';
import { db } from '../db/posDB';
import { AuditService } from '../services/AuditService';
import api from '../api/client';
import { normalizePhone, isValidMalawianPhone } from '../utils/phoneUtils';

const SettingsPage: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const [lockTime, setLockTime] = React.useState('20:00');
  const [unlockTime, setUnlockTime] = React.useState('06:00');
  const [taxRate, setTaxRate] = React.useState(0);
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
  const [branchName, setBranchName] = React.useState('Main Branch');
  const [branchWhatsApp, setBranchWhatsApp] = React.useState('');
  const [fontSize, setFontSize] = React.useState('medium');
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      const hours = await db.settings.get('lockout_hours');
      if (hours?.value) {
        const value = hours.value as { start: string; end: string };
        setLockTime(value.start);
        setUnlockTime(value.end);
      }
      const tax = await db.settings.get('tax_config');
      if (tax?.value) {
        const value = tax.value as { rate: number; inclusive: boolean };
        setTaxRate(value.rate);
        setTaxInclusive(value.inclusive);
      }

      try {
        const settingsRes = await api.get('/public/settings');
        if (settingsRes.data.success && settingsRes.data.data) {
          const s = settingsRes.data.data;
          setCompanyName(s.companyName || '');
          setSlogan(s.slogan || '');
          setAddress(s.address || '');
          setCompanyPhone(s.phone || '');
          setCompanyEmail(s.email || '');
          setPrimaryColor(s.primaryColor || '#6366f1');
          setCurrency(s.currency || 'MK');

          if (s.primaryColor) {
            document.documentElement.style.setProperty('--color-primary-500', s.primaryColor);
            // Simple way to set others, though in a real app we'd generate a palette
            document.documentElement.style.setProperty('--color-primary-400', s.primaryColor + 'cc');
            document.documentElement.style.setProperty('--color-primary-600', s.primaryColor + 'ee');
          }
        }
      } catch (e) {
        console.error('Failed to load online settings:', e);
      }

      const payment = await db.settings.get('payment_config');
      if (payment?.value) {
        const val = payment.value as { momo: string; bank: string };
        setMomoProvider(val.momo || 'TNM Mpamba, Airtel Money');
        setBankNameSetting(val.bank || 'National Bank, NBS Bank, Standard Bank');
      }

      const currentBranchStr = localStorage.getItem('currentBranch');
      if (currentBranchStr) {
        const branch = JSON.parse(currentBranchStr);
        setBranchName(branch.name || 'Main Branch');
        setBranchWhatsApp(branch.whatsapp || '');
      }

      const storedFontSize = localStorage.getItem('fontSize') || 'medium';
      setFontSize(storedFontSize);
    };
    loadSettings();
  }, []);

  const saveBrandingConfig = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      return toast.error("Please enter a valid working company email address");
    }
    try {
      const payload = {
        companyName,
        slogan,
        address,
        phone: companyPhone,
        email: companyEmail,
        primaryColor,
        currency
      };

      await api.post('/settings', payload);
      localStorage.setItem('companyName', companyName);
      localStorage.setItem('currency', currency);

      if (primaryColor) {
        document.documentElement.style.setProperty('--color-primary-500', primaryColor);
      }

      toast.success('Branding and company information updated');
      window.dispatchEvent(new Event('storage'));
    } catch {
      toast.error('Failed to save branding info');
    }
  };

  const savePaymentConfig = async () => {
    try {
      await db.settings.put({ key: 'payment_config', value: { momo: momoProvider, bank: bankNameSetting } });
      toast.success('Payment methods updated');
    } catch {
      toast.error('Failed to save payment config');
    }
  };

  const saveBranchDetails = async () => {
    try {
      if (!isValidMalawianPhone(branchWhatsApp)) {
        toast.error('Invalid Malawian phone format. Please enter 9, 10, or 12 digits starting with +265 or 0');
        return;
      }
      const currentBranchStr = localStorage.getItem('currentBranch');
      if (currentBranchStr) {
        const branch = JSON.parse(currentBranchStr);
        const normalized = normalizePhone(branchWhatsApp);
        const updatedBranch = { ...branch, name: branchName, whatsapp: normalized };
        await db.branches.put(updatedBranch);
        localStorage.setItem('currentBranch', JSON.stringify(updatedBranch));
        setBranchName(updatedBranch.name);
        setBranchWhatsApp(normalized);
        toast.success('Branch details updated');
      }
    } catch {
      toast.error('Failed to save branch details');
    }
  };

  const saveHours = async () => {
    try {
      await db.settings.put({ key: 'lockout_hours', value: { start: lockTime, end: unlockTime } });
      toast.success('Auto-lock hours updated');
    } catch {
      toast.error('Failed to save auto-lock hours');
    }
  };

  const saveTaxConfig = async () => {
    try {
      const config = { rate: taxRate, inclusive: taxInclusive };
      await db.settings.put({ key: 'tax_config', value: config });

      // Also save to server
      await api.post('/settings', {
        tax_config: JSON.stringify(config)
      });

      toast.success('Tax configuration updated globally');
    } catch {
      toast.error('Failed to save tax configuration');
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error("Could not access camera");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      updateProfilePic(base64);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const updateProfilePic = async (base64Pic: string) => {
    try {
      const updatedUser = { ...user, profile_pic: base64Pic };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      const token = localStorage.getItem('token');
      if (token) {
        await api.put(`/users/\${user.id}`, { profile_pic: base64Pic });
      }
      toast.success('Profile picture updated');
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    } catch {
      toast.error('Failed to update profile picture');
    }
  };

  const toggleSystemLock = async (isLocked: boolean) => {
    try {
      await db.settings.put({ key: 'system_lock', value: isLocked });
      await AuditService.log(isLocked ? 'SYSTEM_LOCKED' : 'SYSTEM_UNLOCKED', `System manually \${isLocked ? 'locked' : 'unlocked'} by \${user.username}`);
      toast.success(`System \${isLocked ? 'Locked' : 'Unlocked'}`);
      window.location.reload();
    } catch {
      toast.error('Failed to update system lock');
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-surface-bg transition-all pb-24 md:pb-0 px-0">


      <div className="p-0 space-y-6 md:space-y-0">
        <div className="px-6 md:px-12 py-10 bg-surface-card border-b border-surface-border flex flex-col md:flex-row items-center md:items-start gap-8 group transition-all duration-500">
          <div className="relative w-32 h-32 shrink-0">
            <div className="w-32 h-32 bg-primary-500/10 text-primary-500 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary-500/20 group-hover:border-primary-500 transition-all shadow-2xl p-1">
              {user.profile_pic ? (
                <img src={user.profile_pic} alt="Profile" className="w-full h-full object-cover rounded-full" />
              ) : (
                <User className="w-12 h-12" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 flex gap-2">
              <label className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform border-4 border-surface-card" title="Upload Photo">
                <Plus className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  title="Upload profile picture"
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
                onClick={startCamera}
                className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform border-4 border-surface-card"
                title="Take Photo"
              >
                <Video className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h2 className="text-3xl font-black tracking-tighter uppercase">{user.fullname || user.username || 'Employee'}</h2>
            <div className="card-label !mt-1 uppercase">Branch: {user.branch_name || 'Domasi Main'}</div>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
              <span className="px-4 py-1.5 bg-primary-500/10 text-primary-500 rounded-none text-[10px] font-black tracking-widest border border-primary-500/20 uppercase">Role: {user.role || 'Staff'}</span>
              <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-none text-[10px] font-black tracking-widest border border-emerald-500/20 uppercase">Online Status</span>
            </div>
          </div>
        </div>

        <div className="space-y-px">
          <div className="bg-surface-card border-b border-surface-border overflow-hidden">
            <div className="px-6 md:px-12 py-5 bg-surface-bg border-b border-surface-border">
              <div className="card-label !mb-0 uppercase">System preferences</div>
            </div>

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 border-b border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:bg-primary-500/[0.02] transition-colors">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 flex items-center justify-center shrink-0 bg-surface-bg border border-surface-border rounded-full overflow-hidden shadow-inner">
                    {localStorage.getItem('companyLogo') ? (
                      <img src={localStorage.getItem('companyLogo')!} alt="Company Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-8 h-8 text-surface-text/10" />
                    )}
                  </div>
                  <div>
                    <div className="font-black text-base tracking-tight uppercase">Company branding</div>
                    <div className="card-label !mb-0 uppercase">Set a circular logo for the system header</div>
                  </div>
                </div>
                <label className="btn-primary !px-6 !py-3 text-[10px] font-black tracking-widest cursor-pointer w-full md:w-auto text-center shadow-lg shadow-primary-500/20 uppercase" title="Upload company logo">
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    title="Choose company logo file"
                    aria-label="Choose company logo file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64Logo = reader.result as string;
                          localStorage.setItem('companyLogo', base64Logo);

                          try {
                            const token = localStorage.getItem('token');
                            if (token) {
                              await api.post('/settings', { logo: base64Logo }, {
                                headers: { Authorization: `Bearer \${token}` }
                              });
                            }
                            toast.success('Logo updated');
                            window.dispatchEvent(new Event('storage'));
                            window.location.reload();
                          } catch {
                            toast.error('Failed to save logo to database');
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="px-6 md:px-12 py-6 flex items-center justify-between group hover:bg-primary-500/[0.02] transition-colors border-b border-surface-border">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                  <Smartphone className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <div className="font-black text-sm tracking-tight">Appearance</div>
                  <div className="text-xs text-surface-text/40 font-bold">Switch between light and dark themes</div>
                </div>
              </div>
              <ThemeToggle />
            </div>

            <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary-500/[0.02] transition-colors border-b border-surface-border">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                  <TrendingUp className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <div className="font-black text-sm tracking-tight">Font size</div>
                  <div className="text-xs text-surface-text/40 font-bold">Adjust the system typography scale</div>
                </div>
              </div>
              <div className="flex gap-2 p-1 bg-surface-bg border border-surface-border rounded-2xl w-full md:w-fit">
                {['small', 'medium', 'large'].map((size) => {
                  const isSelected = fontSize === size;
                  return (
                    <button
                      key={size}
                      title={`Set font size to ${size}`}
                      onClick={() => {
                        setFontSize(size);
                        localStorage.setItem('fontSize', size);
                        document.documentElement.setAttribute('data-font-size', size);
                        toast.success(`Font size set to ${size}`);
                      }}
                      className={clsx(
                        "px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all flex-1 md:flex-none",
                        isSelected ? "bg-primary-500 text-white shadow-lg" : "text-surface-text/40 hover:bg-surface-border/50"
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 flex flex-col gap-10 group hover:bg-primary-500/[0.02] transition-colors border-b border-surface-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                    <Building2 className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Branding & company info</div>
                    <div className="text-xs text-surface-text/40 font-bold">Configure your system-wide brand identity and contact details</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Basic Info */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Shop name</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                        placeholder="e.g. MsikaPos Cloud"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Slogan / motto</label>
                      <input
                        type="text"
                        value={slogan}
                        onChange={(e) => setSlogan(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                        placeholder="e.g. Your Business, Simplified"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Business address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="input-field w-full py-3 px-4 text-sm font-black shadow-inner min-h-[100px]"
                        placeholder="Enter physical address..."
                      />
                    </div>
                  </div>

                  {/* Contact & Style */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Phone</label>
                        <input
                          type="text"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                          placeholder="+265..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Email</label>
                        <input
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                          placeholder="info@msikapos.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">System theme color</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {[
                            { hex: '#6366f1', bg: 'bg-[#6366f1]' },
                            { hex: '#10b981', bg: 'bg-[#10b981]' },
                            { hex: '#f59e0b', bg: 'bg-[#f59e0b]' },
                            { hex: '#ef4444', bg: 'bg-[#ef4444]' },
                            { hex: '#3b82f6', bg: 'bg-[#3b82f6]' },
                            { hex: '#8b5cf6', bg: 'bg-[#8b5cf6]' },
                            { hex: '#ec4899', bg: 'bg-[#ec4899]' }
                          ].map(color => (
                            <button
                              key={color.hex}
                              onClick={() => setPrimaryColor(color.hex)}
                              className={clsx(
                                "w-8 h-8 rounded-lg border transition-all active:scale-90",
                                color.bg,
                                primaryColor === color.hex ? "border-white scale-110 shadow-lg" : "border-transparent"
                              )}
                              title={`Set color to ${color.hex}`}
                              aria-label={`Set system theme color to ${color.hex}`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-12 h-12 rounded-xl border border-surface-border bg-surface-bg cursor-pointer p-1"
                            title="Custom color picker"
                          />
                          <input
                            type="text"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="input-field flex-1 py-3 px-4 text-xs font-black shadow-inner"
                            placeholder="#6366f1"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Base currency</label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="input-field w-full py-3 px-4 text-sm font-black shadow-inner appearance-none bg-surface-bg"
                          title="Select system currency"
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
                      <button onClick={saveBrandingConfig} className="btn-primary w-full !py-4 text-[10px] font-black tracking-[0.2em] shadow-xl shadow-primary-500/20">
                        Update brand identity
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSuperAdmin && (
              <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary-500/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                    <Wallet className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Payment methods</div>
                    <div className="text-xs text-surface-text/40 font-bold">Configure mobile money and bank names (separate with commas)</div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-4 mt-2">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Momo provider</label>
                    <input
                      type="text"
                      value={momoProvider}
                      onChange={(e) => setMomoProvider(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="e.g. TNM Mpamba, Airtel Money"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Bank name</label>
                    <input
                      type="text"
                      value={bankNameSetting}
                      onChange={(e) => setBankNameSetting(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="e.g. National Bank, NBS Bank, Standard Bank"
                    />
                  </div>
                  <div className="w-full md:w-auto">
                    <button onClick={savePaymentConfig} className="btn-primary !px-8 !py-3 text-[10px] font-black tracking-widest w-full md:w-auto shadow-lg shadow-primary-500/20">
                      Save config
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isSuperAdmin && (
            <div className="bg-surface-card border-b border-surface-border overflow-hidden">
              <div className="px-6 md:px-12 py-5 bg-red-500/5 border-b border-surface-border">
                <h3 className="text-[10px] font-black text-red-500 tracking-[0.2em]">System security & control</h3>
              </div>

              <div className="px-6 md:px-12 py-8 border-b border-surface-border flex items-center justify-between group hover:bg-red-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 group-hover:border-red-500 transition-all">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Force system lock</div>
                    <div className="text-xs text-surface-text/40 font-bold">Immediately restrict access for all non-admin users</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleSystemLock(true)}
                  className="btn-primary !bg-red-500 hover:!bg-red-600 !px-8 !py-3 text-[10px] font-black tracking-widest shadow-lg shadow-red-900/20"
                  title="Lock system access"
                >
                  Lock access
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 flex items-center justify-between group hover:bg-primary-500/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-2xl flex items-center justify-center border border-primary-500/20 group-hover:border-primary-500 transition-all">
                    <Lock className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Module permissions</div>
                    <div className="text-xs text-surface-text/40 font-bold">Configure what Admins and Cashiers can see and do</div>
                  </div>
                </div>
                <button
                  onClick={() => window.location.href = '/staff/feature-access'}
                  className="btn-primary !bg-primary-600 hover:!bg-primary-700 !px-8 !py-3 text-[10px] font-black tracking-widest shadow-lg shadow-primary-900/20"
                  title="Manage Module Access"
                >
                  Manage access
                </button>
              </div>

              <div className="px-6 md:px-12 py-8 border-b border-surface-border flex flex-col gap-4 group hover:bg-primary-500/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                    <History className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Working hours auto-lock</div>
                    <div className="text-xs text-surface-text/40 font-bold">Access is restricted daily during these off hours</div>
                  </div>
                </div>
                <div className="flex items-end gap-4 mt-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Lock time</label>
                    <input
                      type="time"
                      value={lockTime}
                      onChange={(e) => setLockTime(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      title="Set lock time"
                      aria-label="Set lock time"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Unlock time</label>
                    <input
                      type="time"
                      value={unlockTime}
                      onChange={(e) => setUnlockTime(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      title="Set unlock time"
                      aria-label="Set unlock time"
                    />
                  </div>
                  <div className="w-full md:w-auto">
                    <button onClick={saveHours} className="btn-primary !px-8 !py-3 text-[10px] font-black tracking-widest shadow-lg shadow-primary-500/20" title="Save auto-lock hours">
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary-500/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Tax configuration</div>
                    <div className="text-xs text-surface-text/40 font-bold">Set global tax rate and calculation method</div>
                  </div>
                </div>
                <div className="space-y-6 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setTaxInclusive(true)}
                      className={clsx(
                        "p-6 rounded-2xl border-2 text-left transition-all",
                        taxInclusive ? "bg-primary-500/5 border-primary-500 shadow-sm" : "bg-surface-bg border-surface-border opacity-50 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", taxInclusive ? "bg-primary-500 text-white" : "bg-zinc-200 text-zinc-500")}>
                          <div className="text-[10px] font-black">INC</div>
                        </div>
                        <span className="font-black text-sm tracking-tight">Tax inclusive</span>
                      </div>
                      <p className="text-[10px] font-bold text-surface-text/40 leading-relaxed">Tax is already built into your selling price. Total price won't change at checkout.</p>
                    </button>

                    <button
                      onClick={() => setTaxInclusive(false)}
                      className={clsx(
                        "p-6 rounded-2xl border-2 text-left transition-all",
                        !taxInclusive ? "bg-primary-500/5 border-primary-500 shadow-sm" : "bg-surface-bg border-surface-border opacity-50 hover:opacity-100"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", !taxInclusive ? "bg-primary-500 text-white" : "bg-zinc-200 text-zinc-500")}>
                          <div className="text-[10px] font-black">EXC</div>
                        </div>
                        <span className="font-black text-sm tracking-tight">Tax exclusive</span>
                      </div>
                      <p className="text-[10px] font-bold text-surface-text/40 leading-relaxed">Tax is added on top of your selling price during checkout. Total price will increase.</p>
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row items-end gap-6 p-6 bg-surface-bg/50 border border-surface-border rounded-2xl">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest mb-2 block">Global tax rate (%)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500 font-black">%</span>
                        <input
                          type="number"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="input-field w-full py-4 pl-10 pr-4 text-xl font-black shadow-inner"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <button onClick={saveTaxConfig} className="btn-primary !px-12 !py-4 text-[10px] font-black tracking-widest shadow-xl shadow-primary-500/20 w-full md:w-auto">
                      Update tax policy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isSuperAdmin && (
            <div className="bg-surface-card border-b border-surface-border overflow-hidden">
              <div className="px-6 md:px-12 py-5 bg-surface-bg border-b border-surface-border">
                <div className="card-label !mb-0">Branch & location</div>
              </div>
              <div className="px-6 md:px-12 py-8 flex flex-col gap-4 group hover:bg-primary-500/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-bg rounded-2xl flex items-center justify-center border border-surface-border group-hover:border-primary-500/20 transition-all">
                    <Store className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-black text-sm tracking-tight">Branch details</div>
                    <div className="text-xs text-surface-text/40 font-bold">Configure contact details for this branch</div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-end gap-4 mt-2">
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Branch name</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="e.g. Main Branch"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[10px] font-black text-surface-text/40 ml-1 tracking-widest">Whatsapp number</label>
                    <input
                      type="tel"
                      value={branchWhatsApp}
                      onChange={(e) => setBranchWhatsApp(e.target.value)}
                      className="input-field w-full py-3 px-4 text-sm font-black shadow-inner"
                      placeholder="+265..."
                    />
                  </div>
                  <div className="w-full md:w-auto">
                    <button onClick={saveBranchDetails} className="btn-primary !px-8 !py-3 text-[10px] font-black tracking-widest shadow-lg shadow-primary-500/20">
                      Save branch info
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-surface-card rounded-[2.5rem] overflow-hidden border border-surface-border shadow-2xl relative">
            <button
              onClick={stopCamera}
              title="Close Camera"
              className="absolute top-6 right-6 z-10 w-10 h-10 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-square bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="p-8 text-center space-y-6">
              <div>
                <h3 className="text-xl font-black tracking-tighter">Capture profile</h3>
                <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Position yourself clearly in the frame</p>
              </div>

              <button
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full border-8 border-primary-500 shadow-2xl active:scale-90 transition-all mx-auto"
                title="Capture"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Mail, 
  Phone, 
  Home, 
  Users, 
  Lock, 
  ChevronRight, 
  Check, 
  Loader2, 
  Camera,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { OTPInput } from '../components/OTPInput';
import { useSearchParams } from 'react-router-dom';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isTokenValidating, setIsTokenValidating] = useState(!!searchParams.get('magicToken'));
  const [tokenError, setTokenError] = useState<string | null>(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Form States
  const [fullname, setFullname] = useState(user.fullname || '');
  const [nationalId, setNationalId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Magic Link Detection & Validation
  React.useEffect(() => {
    const magicToken = searchParams.get('magicToken');
    console.log('🔍 [Onboarding] Checking for magicToken:', magicToken ? 'FOUND' : 'NOT FOUND');

    if (magicToken) {
      if (localStorage.getItem('token')) {
        console.log('✅ [Onboarding] User already has a session, skipping token validation.');
        setIsTokenValidating(false);
        return;
      }

      const validateToken = async () => {
        console.log('📡 [Onboarding] Validating token with backend...');
        try {
          const res = await api.post('/onboarding/validate', { token: magicToken });
          console.log('✅ [Onboarding] Token is VALID. Received staff info:', res.data.user.username);
          
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          setFullname(res.data.user.fullname || '');
          setIsTokenValidating(false);
          toast.success("Welcome! Please complete your profile.");
        } catch (err: any) {
          console.error('❌ [Onboarding] Token validation FAILED:', err.response?.data?.message || err.message);
          setTokenError("This onboarding link is invalid or expired.");
          setIsTokenValidating(false);
        }
      };
      validateToken();
    } else if (!localStorage.getItem('token')) {
      console.log('⚠️ [Onboarding] No token and no session. Redirecting to login.');
      navigate('/staff/login');
    }
  }, [searchParams, navigate]);

  const malawianPhoneRegex = /^(\+265|0)[89]\d{8}$/;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setProfilePic(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!fullname) return toast.error("Full name is required");
      if (!/^[A-Z0-9]{8}$/.test(nationalId.toUpperCase())) {
        return toast.error("National ID must be 8 alphanumeric characters");
      }
      if (!malawianPhoneRegex.test(phone)) {
        return toast.error("Phone must be a valid Malawian number (e.g., 088... or 099...)");
      }
    }
    setStep(prev => prev + 1);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      return toast.error("Passwords don't match");
    }

    if (nextOfKinPhone && !malawianPhoneRegex.test(nextOfKinPhone)) {
      return toast.error("Next of Kin Phone must be a valid Malawian number");
    }

    setLoading(true);
    try {
      await api.post('/users/onboarding', {
        fullname,
        nationalId: nationalId.toUpperCase(),
        email,
        phone,
        profilePic,
        homeAddress,
        nextOfKinName,
        nextOfKinPhone,
        relationship,
        newPassword: newPassword || undefined
      });
      toast.success("Profile updated! Check your email for verification code.");
      nextStep();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users/verify', { code: verificationCode });
      toast.success("Account verified! Welcome to MsikaPos.");
      
      // Update local user object
      const updatedUser = { ...user, isVerified: true, fullname, profilePic };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg text-surface-text flex items-center justify-center p-6 selection:bg-primary-500/30">
      <div className="w-full max-w-xl relative">
        {/* Progress Bar */}
        <div className="absolute -top-12 left-0 right-0 flex justify-between px-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s}
              className={`h-1 flex-1 mx-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-primary-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]' : 'bg-surface-border'}`}
            />
          ))}
        </div>

        <motion.div 
          layout
          className="glass-panel p-8 md:p-12 relative overflow-hidden"
        >
          {isTokenValidating ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              <p className="text-[10px] font-black tracking-widest text-surface-text/40 uppercase">Validating onboarding link...</p>
            </div>
          ) : tokenError ? (
            <div className="text-center py-20 space-y-6">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                 <Lock className="w-10 h-10 text-red-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-red-500 mb-2">Access Denied</h2>
                <p className="text-surface-text/40 text-[10px] font-black tracking-widest uppercase">{tokenError}</p>
              </div>
              <button onClick={() => navigate('/staff/login')} className="btn-primary !px-10 mx-auto">Go to Login</button>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-3xl font-black  tracking-tighter text-primary-500 mb-2">Welcome to MsikaPos</h1>
                  <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Complete your profile to unlock the system</p>
                </div>

                <div className="flex justify-center">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full border-4 border-surface-border overflow-hidden bg-surface-bg flex items-center justify-center group-hover:border-primary-500 transition-all shadow-2xl">
                      {profilePic ? (
                        <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-12 h-12 text-surface-text/10" />
                      )}
                    </div>
                    <label htmlFor="profile-upload" className="absolute bottom-0 right-0 w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-all border-4 border-surface-card">
                      <Camera className="w-5 h-5 text-white" />
                      <input id="profile-upload" title="Upload Profile Picture" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="fullname" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="fullname"
                        type="text" 
                        title="Enter your full name"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="John Doe"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="nationalId" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">National ID</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="nationalId"
                        type="text" 
                        title="Enter your 8-character national ID"
                        maxLength={8}
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="ABC12345"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="email"
                        type="email" 
                        title="Enter your working email"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="john@msikapos.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="phone"
                        type="tel" 
                        title="Enter your phone number (10 digits or +265...)"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="+265..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="homeAddress" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Home Address</label>
                    <div className="relative">
                      <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="homeAddress"
                        type="text" 
                        title="Enter your home address"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="Street, City, House Number"
                        value={homeAddress}
                        onChange={(e) => setHomeAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={nextStep}
                    className="btn-primary group !px-8 h-14"
                  >
                    Next Details
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-2xl font-black  tracking-tighter text-primary-500 mb-2">Security & Contacts</h1>
                  <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Protect your account and emergency info</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="nok-name" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Next of Kin Name</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="nok-name"
                        type="text" 
                        title="Enter next of kin name"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="Full Name"
                        value={nextOfKinName}
                        onChange={(e) => setNextOfKinName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="nok-phone" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Next of Kin Phone</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="nok-phone"
                        type="tel" 
                        title="Enter next of kin phone number"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="088... or 099..."
                        value={nextOfKinPhone}
                        onChange={(e) => setNextOfKinPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="relationship" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Relationship</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                      <input 
                        id="relationship"
                        type="text" 
                        title="Relationship with next of kin"
                        className="input-field w-full pl-10 h-12 text-sm font-bold" 
                        placeholder="e.g. Spouse, Parent"
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {user.mustChangePassword && (
                  <div className="space-y-4 pt-4 border-t border-surface-border/50">
                    <div className="space-y-2">
                      <label htmlFor="newPassword" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Create New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                        <input 
                          id="newPassword"
                          type={showPassword ? "text" : "password"} 
                          title="Enter a strong new password"
                          className="input-field w-full pl-10 pr-12 h-12 text-sm font-bold" 
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-text/20 hover:text-surface-text transition-all"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Confirm New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                        <input 
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"} 
                          title="Repeat your new password"
                          className="input-field w-full pl-10 pr-12 h-12 text-sm font-bold" 
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-text/20 hover:text-surface-text transition-all"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <button onClick={() => setStep(1)} className="text-[10px] font-black tracking-widest text-surface-text/30 hover:text-surface-text transition-all">Go Back</button>
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={loading}
                    className="btn-primary !px-10 h-14"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : (
                      <>
                        Verify Email
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8 text-center"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="w-10 h-10 text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-black  tracking-tighter text-emerald-500 mb-2">Check Your Inbox</h1>
                  <p className="text-surface-text/40 text-xs max-w-[280px] mx-auto">We've sent a 6-digit verification code to <span className="text-surface-text font-bold">{email}</span></p>
                </div>

                <div className="space-y-6">
                  <OTPInput 
                    value={verificationCode}
                    onChange={setVerificationCode}
                    disabled={loading}
                  />
                  
                  <button 
                    onClick={handleVerify}
                    disabled={loading || verificationCode.length < 6}
                    className="btn-primary w-full h-16 shadow-2xl shadow-primary-500/20"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : (
                      <>
                        Complete Activation
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] font-black tracking-widest text-surface-text/20">
                    Didn't receive code? <button onClick={handleUpdateProfile} className="text-primary-500 hover:underline">Resend</button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingPage;

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
  Camera,
  ShieldCheck,
  Eye,
  EyeOff,
  Video,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { restrictPhone } from '../utils/phoneUtils';
import { OTPInput } from '../components/OTPInput';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score < 2) return { label: 'Weak', color: 'bg-red-500', score };
    if (score < 4) return { label: 'Medium', color: 'bg-amber-500', score };
    return { label: 'Strong', color: 'bg-emerald-500', score };
  };

  const magicToken = searchParams.get('magicToken');

  // Magic Link Detection & Validation
  React.useEffect(() => {
    console.log('🔍 [Onboarding] Checking for magicToken:', magicToken ? 'FOUND' : 'NOT FOUND');

    if (magicToken) {
      if (localStorage.getItem('token')) {
        console.log('✅ [Onboarding] User already has a session, skipping token validation.');
        return;
      }

      const validateToken = async () => {
        setLoading(true);
        console.log('📡 [Onboarding] Validating token with backend...');
        try {
          const res = await api.post('/onboarding/validate', { token: magicToken });
          console.log('✅ [Onboarding] Token is VALID. Received staff info:', res.data.user.username);
          
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          setFullname(res.data.user.fullname || '');
          toast.success("Welcome! Please complete your profile.");
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } }, message?: string };
          console.error('❌ [Onboarding] Token validation FAILED:', error.response?.data?.message || error.message);
          setTokenError(error.response?.data?.message || "Connection failed. Please refresh or try again.");
        } finally {
          setLoading(false);
        }
      };
      validateToken();
    } else if (!localStorage.getItem('token')) {
      console.log('⚠️ [Onboarding] No token and no session. Redirecting to login.');
      navigate('/staff/login');
    }
  }, [magicToken, navigate]);

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

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: unknown) {
      console.error("Camera error:", err);
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
      setProfilePic(base64);
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.mustChangePassword) {
      if (newPassword.length < 8 || newPassword.length > 16) {
        return toast.error("Password must be between 8 and 16 characters");
      }
      const strength = getPasswordStrength(newPassword);
      if (strength.score < 3) {
        return toast.error("Please use a stronger password (include letters, numbers and symbols)");
      }
      if (newPassword !== confirmPassword) {
        return toast.error("Passwords don't match");
      }
    }

    if (nextOfKinPhone && !malawianPhoneRegex.test(nextOfKinPhone)) {
      return toast.error("Next of Kin Phone must be a valid Malawian number");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("Please enter a valid working email address");
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "Update failed");
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
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }, message?: string };
      toast.error(error.response?.data?.message || "Verification failed");
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
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="loading-spinner w-16 h-16 border-8" />
              <p className="text-[10px] font-black tracking-widest text-surface-text/40 uppercase animate-pulse">Establishing secure connection...</p>
            </div>
          )}

          {!loading && tokenError && (
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
          )}

          {!loading && !tokenError && (
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
                    <div className="absolute -bottom-2 -right-2 flex gap-2">
                      <label className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-all border-4 border-surface-card" title="Upload Photo">
                        <Camera className="w-5 h-5" />
                        <input id="profile-upload" title="Upload Profile Picture" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                      <button 
                        type="button"
                        onClick={startCamera}
                        className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all border-4 border-surface-card" 
                        title="Take Photo"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                    </div>
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
                     <label htmlFor="nationalId" className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1 uppercase">National ID (8 Chars)</label>
                     <div className="relative">
                       <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                       <input 
                         id="nationalId"
                         type="text" 
                         title="Enter your 8-character national ID"
                         maxLength={8}
                         className="input-field w-full pl-10 h-12 text-sm font-black tracking-[0.2em] uppercase" 
                         placeholder="ABC12345"
                         value={nationalId}
                         onChange={(e) => setNationalId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
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
  onChange={(e) => setPhone(restrictPhone(e.target.value))}
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
  onChange={(e) => setNextOfKinPhone(restrictPhone(e.target.value))}
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
                          maxLength={16}
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
                      {/* Password Strength Bar */}
                      {newPassword && (
                        <div className="px-1 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black tracking-widest text-surface-text/30 uppercase">Security Strength</span>
                            <span className={clsx("text-[8px] font-black tracking-widest uppercase", 
                              getPasswordStrength(newPassword).score >= 3 ? "text-emerald-500" : "text-amber-500"
                            )}>
                              {getPasswordStrength(newPassword).label}
                            </span>
                          </div>
                          <div className="h-1 w-full bg-surface-border rounded-full overflow-hidden flex gap-0.5">
                            {[1, 2, 4].map((s) => (
                              <div 
                                key={s}
                                className={clsx(
                                  "h-full flex-1 transition-all duration-500",
                                  getPasswordStrength(newPassword).score >= s ? getPasswordStrength(newPassword).color : "bg-transparent"
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}
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
                          maxLength={16}
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
                      {loading ? <div className="loading-spinner w-5 h-5 border-2 border-t-white" /> : (
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
                    {loading ? <div className="loading-spinner w-6 h-6 border-2 border-t-white" /> : (
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

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
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
                  <h3 className="text-xl font-black tracking-tighter uppercase">Capture Profile</h3>
                  <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Position yourself clearly in the frame</p>
                </div>
                
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full border-8 border-primary-500 shadow-2xl active:scale-90 transition-all mx-auto"
                  title="Capture"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingPage;

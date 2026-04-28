import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User, ShieldCheck, Loader2, ChevronRight, ArrowLeft, Lock, Check } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { OTPInput } from '../components/OTPInput';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { username, email });
      toast.success("Verification code sent to your email!");
      setStep(2);
    } catch (err: any) {
      if (err.response?.status === 404) {
        toast.error("Details don't match. Admin has been notified.");
      } else {
        toast.error(err.response?.data?.message || "Request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("Passwords don't match");
    
    setLoading(true);
    try {
      // Re-use onboarding endpoint or a specific reset one if exists
      // For now, we'll use a placeholder or generic update
      await api.post('/users/verify', { code, newPassword });
      toast.success("Password reset successful!");
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg text-surface-text flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8 relative overflow-hidden"
      >
        <Link to="/login" className="absolute top-8 left-8 p-2 rounded-xl bg-surface-bg border border-surface-border text-surface-text/40 hover:text-surface-text transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="pt-10 space-y-8"
            >
              <div className="text-center">
                <h1 className="text-3xl font-black  tracking-tighter text-primary-500 mb-2">Reset Password</h1>
                <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Enter your registered details</p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/20" />
                    <input 
                      type="text" 
                      required
                      className="input-field w-full pl-12 h-14 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/20" />
                    <input 
                      type="email" 
                      required
                      className="input-field w-full pl-12 h-14 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                      placeholder="Your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-16 shadow-2xl shadow-primary-500/20"
                >
                  {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                      Send Reset Code
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="pt-10 space-y-8"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-black  tracking-tighter text-emerald-500 mb-2">Check Your Email</h1>
                <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Enter code and new password</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">6-Digit Code</label>
                  <OTPInput 
                    value={code}
                    onChange={setCode}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                    <input 
                      type="password" 
                      required
                      className="input-field w-full pl-10 h-12 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-surface-text/30 pl-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                    <input 
                      type="password" 
                      required
                      className="input-field w-full pl-10 h-12 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full h-16 shadow-2xl shadow-primary-500/20 mt-4"
                >
                  {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                      Reset Password
                      <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;

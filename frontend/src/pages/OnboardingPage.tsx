import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { clsx } from 'clsx';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  useEffect(() => {
    if (magicToken) {
      // Force clear any existing session to prevent resetting the logged-in user's password
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      
      const validateToken = async () => {
        setLoading(true);
        try {
          const res = await api.post('/onboarding/validate', { token: magicToken });
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          toast.success("Welcome! Please change your password.");
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } }, message?: string };
          setTokenError(error.response?.data?.message || "Connection failed. Please try again.");
        } finally {
          setLoading(false);
        }
      };
      validateToken();
    } else if (!(localStorage.getItem('token') || sessionStorage.getItem('token'))) {
      navigate('/staff/login');
    }
  }, [magicToken, navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);
    try {
      await api.post('/users/onboarding', {
        newPassword
      });
      toast.success("Password updated! Welcome.");
      
      const updatedUser = { ...user, isVerified: true, mustChangePassword: false };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      if (updatedUser.role === 'CUSTOMER') {
        navigate('/');
      } else if (updatedUser.role === 'CASHIER') {
        navigate('/staff/pos');
      } else {
        navigate('/staff/dashboard');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg text-surface-text flex items-center justify-center p-6 selection:bg-primary-500/30">
      <div className="w-full max-w-md relative">
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
              <motion.div
                key="changePassword"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center">
                  <h1 className="text-2xl font-black tracking-tighter text-primary-500 mb-2">Change Password</h1>
                  <p className="text-surface-text/40 text-[10px] font-black tracking-widest">Set a new password to unlock the system</p>
                </div>

                <div className="space-y-4 pt-4">
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

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleUpdatePassword}
                    disabled={loading}
                    className="btn-primary w-full h-14"
                  >
                    {loading ? <div className="loading-spinner w-5 h-5 border-2 border-t-white" /> : (
                      <>
                        Unlock System
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingPage;

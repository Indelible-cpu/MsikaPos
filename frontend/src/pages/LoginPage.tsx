import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Lock, User as UserIcon, Eye, EyeOff, Fingerprint, ChevronRight, ShieldCheck, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { AuditService } from '../services/AuditService';

interface UserData {
  id: string;
  username: string;
  role: string;
  fullname: string;
  mustChangePassword?: boolean;
  isVerified?: boolean;
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [loginMode, setLoginMode] = useState<'biometric' | 'password'>('password');
  const [hasPromptedBiometric, setHasPromptedBiometric] = useState(false);

  const handleBiometricLogin = useCallback(async () => {
    try {
      setLoading(true);
      if (window.PublicKeyCredential) {
        toast.loading('Verifying identity...', { id: 'biometric-auth' });
        
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        const credentialId = localStorage.getItem('biometricCredentialId');
        const allowCredentials: any[] = [];
        
        if (credentialId) {
          // Convert base64 back to Uint8Array
          const binaryId = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));
          allowCredentials.push({
            id: binaryId,
            type: 'public-key',
            transports: ['internal']
          });
        }

        await navigator.credentials.get({
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: 'required',
            allowCredentials
          },
          mediation: 'required'
        });

        const userDataStr = localStorage.getItem('user');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          await AuditService.log('BIOMETRIC_LOGIN', 'User signed in using biometrics');
          toast.success('Welcome back!', { id: 'biometric-auth' });
          SyncService.pushSales().catch(console.error);
          
          if (userData.role === 'CUSTOMER') {
            window.location.href = '/';
          } else if (userData.role === 'CASHIER') {
            window.location.href = '/staff/pos';
          } else {
            window.location.href = '/staff/dashboard';
          }
        } else {
          throw new Error('Please login with password first.');
        }
      }
    } catch (err: unknown) {
      console.warn('Biometric error:', err);
      const error = err as Error;
      if (error.name !== 'NotAllowedError') {
        toast.error('Biometric verification failed.', { id: 'biometric-auth' });
      } else {
        toast.dismiss('biometric-auth');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const registerBiometrics = async () => {
    try {
      if (!window.PublicKeyCredential) return;
      setLoading(true);
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      const userId = Uint8Array.from(String(user.id || '1'), c => c.charCodeAt(0));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'MsikaPos', id: window.location.hostname },
          user: {
            id: userId,
            name: user.username || 'user',
            displayName: user.fullname || 'User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, 
            { alg: -257, type: 'public-key' }
          ],
          authenticatorSelection: { 
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000
        }
      });

      if (credential) {
        const pubKeyCred = credential as PublicKeyCredential;
        // Store the credential ID as base64
        const idBase64 = btoa(String.fromCharCode(...new Uint8Array(pubKeyCred.rawId)));
        
        localStorage.setItem('biometricCredentialId', idBase64);
        localStorage.setItem('biometricRegistered', 'true');
        setIsBiometricAvailable(true);
        setShowBiometricPrompt(false);
        toast.success('Biometric login enabled for this device!');
        
        if (user.role === 'CUSTOMER') {
          window.location.href = '/';
        } else if (user.role === 'CASHIER') {
          window.location.href = '/staff/pos';
        } else {
          window.location.href = '/staff/dashboard';
        }
      }
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        toast.error('Registration canceled or not allowed.');
      } else {
        toast.error('Could not register biometrics.');
      }
      setShowBiometricPrompt(false);
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.role === 'CUSTOMER') {
        window.location.href = '/';
      } else if (user.role === 'CASHIER') {
        window.location.href = '/staff/pos';
      } else {
        window.location.href = '/staff/dashboard';
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkBiometrics = async () => {
      const isMobile = window.innerWidth < 768;
      if (window.PublicKeyCredential) {
        // We check availability but also if the user HAS a registered ID for THIS site
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        const registered = localStorage.getItem('biometricRegistered') === 'true';
        
        setIsBiometricAvailable(available);
        if (registered) {
          setLoginMode('biometric');
        }
      } else {
        setIsBiometricAvailable(false);
      }
    };
    checkBiometrics();
  }, []);

  // Auto-trigger biometric prompt
  useEffect(() => {
    if (loginMode === 'biometric' && !hasPromptedBiometric && !loading) {
      const timer = setTimeout(() => {
        handleBiometricLogin();
        setHasPromptedBiometric(true);
      }, 500); // Small delay for smooth entry
      return () => clearTimeout(timer);
    }
  }, [loginMode, hasPromptedBiometric, loading, handleBiometricLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let userData: UserData | null = null;
      let userToken: string | null = null;

      try {
        const response = await api.post('/auth/login', { username, password });
        userData = response.data.user;
        userToken = response.data.token;
      } catch (err: unknown) {
        const loginError = err as { response?: { data?: { message?: string } } };
        const msg = loginError.response?.data?.message || 'Invalid credentials';
        throw new Error(msg);
      }
      
      if (userToken && userData) {
        localStorage.setItem('token', userToken);
        localStorage.setItem('user', JSON.stringify(userData));
        await AuditService.log('LOGIN', `User ${username} signed in`);
        
        const isMobile = window.innerWidth < 768;
        const canRegister = isMobile && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        const alreadyRegistered = localStorage.getItem('biometricRegistered') === 'true';
        
        if (canRegister && !alreadyRegistered) {
          setShowBiometricPrompt(true);
        } else {
          toast.success('Welcome back!');
          
          if (userData.role === 'CUSTOMER') {
            window.location.href = '/';
          } else if (!userData.isVerified || userData.mustChangePassword) {
            window.location.href = '/staff/onboarding';
          } else if (userData.role === 'CASHIER') {
            window.location.href = '/staff/pos';
          } else {
            window.location.href = '/staff/dashboard';
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6 bg-surface-bg text-surface-text selection:bg-primary-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 md:glass-panel relative"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 mx-auto flex items-center justify-center overflow-hidden flex-shrink-0 mb-6 rounded-full bg-surface-bg border border-surface-border shadow-2xl p-1"
          >
            <img src="/icon.png?v=2" alt="MsikaPos Icon" className="w-full h-full object-contain" />
          </motion.div>
          <div className="space-y-1">
            <div className="text-[10px] font-black text-primary-500 tracking-[0.4em] opacity-60 ">MsikaPos</div>
            <div className="w-16 h-1 bg-primary-500/10 mx-auto rounded-full"></div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loginMode === 'password' ? (
            <motion.form 
              key="password-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin} 
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-black  tracking-widest text-surface-text/30 pl-1">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/20" />
                  <input 
                    type="text" 
                    required
                    autoComplete="username"
                    className="input-field w-full pl-12 h-14 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black  tracking-widest text-surface-text/30 pl-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/20" />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="input-field w-full pl-12 pr-12 h-14 text-sm font-bold bg-surface-bg/50 border-surface-border/50"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-text/20 hover:text-surface-text transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-primary-500 text-white rounded-3xl font-black  tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-primary-500/20 active:scale-95 transition-all"
              >
                {loading ? <div className="loading-spinner w-6 h-6 border-2 border-t-white" /> : (
                  <>
                    Sign in
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {localStorage.getItem('biometricRegistered') === 'true' && (
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setLoginMode('biometric')}
                    className="text-[10px] font-black tracking-widest text-primary-500 hover:text-primary-400 transition-colors"
                  >
                    Use Biometric Unlock
                  </button>
                </div>
              )}
            </motion.form>
          ) : (
            <motion.div
              key="biometric-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-4"
            >
              <div className="text-center mb-8">
                <h2 className="text-xl font-black tracking-tight mb-2">Biometric Security</h2>
                <p className="text-[9px] font-black tracking-widest text-surface-text/30 uppercase">Fingerprint or Face Recognition</p>
              </div>

              <button 
                onClick={handleBiometricLogin}
                disabled={loading}
                className="group relative w-32 h-32 rounded-full bg-surface-bg border-4 border-surface-border flex items-center justify-center hover:border-primary-500/50 transition-all active:scale-90 overflow-hidden shadow-2xl"
              >
                {loading && (
                  <motion.div 
                    initial={{ rotate: 0 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full"
                  />
                )}
                <Fingerprint className="w-12 h-12 text-primary-500 group-hover:scale-110 transition-transform" />
              </button>

              <div className="mt-12 space-y-4 w-full">
                <button 
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full h-14 bg-primary-500 text-white rounded-2xl font-black tracking-widest text-[10px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all"
                >
                  Unlock System
                </button>
                <button 
                  onClick={() => setLoginMode('password')}
                  className="w-full h-14 bg-surface-card border border-surface-border rounded-2xl font-black tracking-widest text-[10px] text-surface-text/40 hover:text-surface-text active:scale-95 transition-all"
                >
                  Use Password instead
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex flex-col items-center gap-6">
          {!isBiometricAvailable && (
            <div className="px-6 py-4 bg-surface-card border border-surface-border rounded-2xl text-center">
              <p className="text-[9px] font-black tracking-widest text-surface-text/20 uppercase leading-relaxed">
                Biometric security is unavailable on this browser/device.
              </p>
            </div>
          )}

          <Link to="/about" className="md:hidden w-full h-14 bg-surface-card border border-surface-border rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black tracking-widest text-surface-text/40 active:scale-95 transition-all">
            <Info className="w-4 h-4" />
            About Msikapos
          </Link>

          <Link to="/staff/forgot-password" className="text-[10px] font-black  tracking-widest text-surface-text/20 hover:text-primary-500 transition-colors">
             Forgot password?
          </Link>

          <Link to="/about" className="hidden md:block text-[10px] font-black tracking-widest text-surface-text/20 hover:text-primary-500 transition-colors">
            About Msikapos
          </Link>

          <div className="pt-4 text-center">
            <p className="text-[8px] font-black tracking-[0.3em] text-surface-text/10 ">Developed by James Dickson Petro</p>
          </div>
        </div>

        {/* Biometric Registration Prompt */}
        <AnimatePresence>
          {showBiometricPrompt && (
            <motion.div 
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              className="absolute inset-0 z-50 bg-surface-bg/90 rounded-[2rem] flex flex-col items-center justify-center p-8 text-center"
            >
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-full bg-primary-500/10 flex items-center justify-center mb-8 border border-primary-500/20"
              >
                <Fingerprint className="w-12 h-12 text-primary-500" />
              </motion.div>
              
              <h2 className="text-2xl font-black mb-3 tracking-tighter ">Secure Your Account</h2>
              <p className="text-surface-text/50 text-[11px] font-medium mb-10 leading-relaxed max-w-[240px]">
                Enable high-standard biometric authentication for instant and professional system access on this device.
              </p>
              
              <div className="flex flex-col w-full gap-4">
                <button 
                  onClick={registerBiometrics}
                  className="w-full h-16 bg-primary-500 text-white rounded-3xl font-black tracking-widest text-[10px] transition-all active:scale-95 shadow-xl shadow-primary-500/30 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Enable Biometric Login
                </button>
                <button 
                  onClick={() => {
                    setShowBiometricPrompt(false);
                    window.location.href = '/dashboard';
                  }}
                  className="w-full h-14 bg-transparent text-surface-text/30 rounded-2xl font-black tracking-widest text-[10px] transition-all hover:text-surface-text active:scale-95"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LoginPage;

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Lock, User as UserIcon, Eye, EyeOff, Fingerprint, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import { AuditService } from '../services/AuditService';
import { db } from '../db/posDB';
import { hashPassword } from '../utils/cryptoUtils';
import BrandName from '../components/BrandName';

interface UserData {
  id: string;
  username: string;
  role: string;
  fullname: string;
  mustChangePassword?: boolean;
  isVerified?: boolean;
  hasBiometrics?: boolean;
}

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [loginMode, setLoginMode] = useState<'biometric' | 'password'>('password');

  const handleBiometricLogin = useCallback(async () => {
    try {
      setLoading(true);
      if (window.PublicKeyCredential) {
        toast.loading('Verifying identity...', { id: 'biometric-auth' });
        
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        
        const credentialId = localStorage.getItem('biometricCredentialId');
        const allowCredentials: PublicKeyCredentialDescriptor[] = [];
        
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
            allowCredentials,
            timeout: 8000
          }
        });

        const userDataStr = localStorage.getItem('user') || localStorage.getItem('biometricUser');
        const authData = localStorage.getItem('biometricAuth');
        let token = localStorage.getItem('token') || localStorage.getItem('biometricToken');
        
        if (userDataStr) {
          let userData = JSON.parse(userDataStr);
          
          if (authData) {
            try {
              const savedPassword = atob(authData);
              if (navigator.onLine) {
                try {
                  const res = await api.post('/auth/login', { username: userData.username, password: savedPassword });
                  token = res.data.token;
                  userData = res.data.user;
                  
                  const passwordHash = await hashPassword(savedPassword);
                  await db.offlineAuth.put({
                    username: userData.username,
                    passwordHash,
                    userData,
                    token: token!
                  });
                } catch (err: unknown) {
                  const loginError = err as { response?: { status?: number } };
                  if (loginError.response && loginError.response.status !== 500 && loginError.response.status !== 502 && loginError.response.status !== 503) {
                    // Explicitly rejected by server
                    localStorage.removeItem('biometricAuth');
                    localStorage.removeItem('biometricToken');
                    localStorage.removeItem('biometricRegistered');
                    await db.offlineAuth.delete(userData.username);
                    throw new Error('Your account access has changed. Please login with your password.');
                  }
                  // Network error or 5xx, try offline fallback
                  const offlineUser = await db.offlineAuth.get(userData.username);
                  if (offlineUser) token = offlineUser.token;
                }
              } else {
                const offlineUser = await db.offlineAuth.get(userData.username);
                if (offlineUser) token = offlineUser.token;
              }
            } catch (err: unknown) {
              const e = err as Error;
              if (e.message.includes('account access has changed')) throw e;
              localStorage.removeItem('biometricAuth');
              throw new Error('Your biometric credentials are out of date. Please login with password to update.');
            }
          } else {
            if (!token) throw new Error('Please login with password first to enable biometrics.');
            try {
              // Check if token is expired (legacy fallback)
              const payloadBase64 = token.split('.')[1];
              const decodedJson = atob(payloadBase64);
              const decoded = JSON.parse(decodedJson);
              if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                localStorage.removeItem('biometricToken');
                throw new Error('Your session has expired. Please login with password to re-enable biometrics.');
              }
            } catch (e) {
              if (e instanceof Error && e.message.includes('expired')) throw e;
              // Ignore parse errors, let backend handle invalid tokens if offline doesn't catch it
            }
          }
          
          if (!token) throw new Error('Please login with password first to enable biometrics.');

          // Restore session
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('token', token);
          
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
          throw new Error('Please login with password first to enable biometrics.');
        }
      }
    } catch (err: unknown) {
      console.warn('Biometric error:', err);
      const error = err as Error;
      // NotAllowedError = user cancelled, AbortError = dismissed — show nothing
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        toast.dismiss('biometric-auth');
      } else if (error.name === 'UnknownError' || error.message?.toLowerCase().includes('credential manager')) {
        // Generic browser credential manager error — guide user to password
        toast.error('Biometric login unavailable. Please use your password.', { id: 'biometric-auth' });
        setLoginMode('password');
      } else {
        toast.error(error.message || 'Biometric verification failed.', { id: 'biometric-auth' });
        if (error.message?.includes('expired') || error.message?.includes('password first')) {
          setLoginMode('password');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const performRedirect = (userData: any) => {
    if (userData.role === 'CUSTOMER') {
      window.location.href = '/';
    } else if (!userData.isVerified || userData.mustChangePassword) {
      window.location.href = '/staff/onboarding';
    } else if (userData.role === 'CASHIER') {
      window.location.href = '/staff/pos';
    } else {
      window.location.href = '/staff/dashboard';
    }
  };

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
        localStorage.setItem('biometricUser', JSON.stringify(user));
        localStorage.setItem('biometricAuth', btoa(password));
        localStorage.setItem('biometricToken', localStorage.getItem('token') || '');
        
        try {
          if (navigator.onLine) {
            await api.post('/auth/biometrics', { userId: user.id, hasBiometrics: true });
          }
        } catch (e) {
          console.warn('Failed to sync biometric status to backend', e);
        }

        setIsBiometricAvailable(true);
        setShowBiometricPrompt(false);
        toast.success('Biometric login enabled for this device!');
        
        performRedirect(user);
      }
    } catch (err: unknown) {
      console.error('Biometric error:', err);
      const error = err as Error;
      
      // If it's a real error (not just a cancel), show a toast
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        toast.error('Biometric verification failed.');
      }
      
      // Stay on login page but offer password fallback
      setLoginMode('password');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkBiometrics = async () => {
      if (window.PublicKeyCredential) {
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
    
    // Session Awareness: Only clear the token if it has actually expired.
    // Do NOT clear a valid token - the user may have been redirected back here
    // by the app (e.g. sync failure) and still have a valid session.
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      try {
        const payloadBase64 = existingToken.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64));
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          // Token is genuinely expired - clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } else {
          // Token is still valid - redirect back to dashboard instead of showing login
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          if (user.role === 'CASHIER') {
            window.location.href = '/staff/pos';
          } else if (user.role) {
            window.location.href = '/staff/dashboard';
          }
        }
      } catch {
        // Malformed token - clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

  }, [handleBiometricLogin]);

  const hasAutoTriggered = React.useRef(false);

  useEffect(() => {
    if (loginMode === 'biometric' && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      handleBiometricLogin();
    } else if (loginMode === 'password') {
      hasAutoTriggered.current = false;
    }
  }, [loginMode, handleBiometricLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let userData: UserData | null = null;
      let userToken: string | null = null;

      // Online First Login
      if (navigator.onLine) {
        try {
          const response = await api.post('/auth/login', { username, password });
          userData = response.data.user;
          userToken = response.data.token;

          const passwordHash = await hashPassword(password);
          await db.offlineAuth.put({
            username,
            passwordHash,
            userData,
            token: userToken!
          });
        } catch (err: unknown) {
          const loginError = err as { response?: { data?: { message?: string }, status?: number } };
          
          if (loginError.response && loginError.response.status !== 500 && loginError.response.status !== 502 && loginError.response.status !== 503) {
            // True failure (wrong password, suspended, etc). Do not allow offline fallback.
            await db.offlineAuth.delete(username);
            throw new Error(loginError.response?.data?.message || 'Invalid credentials');
          }
          console.warn('Online login failed or server unreachable, attempting offline fallback:', err);
        }
      }

      // Offline Fallback (Only reached if offline, or if server threw 5xx/network error)
      if (!userData) {
        const offlineUser = await db.offlineAuth.get(username);
        if (offlineUser) {
          const passwordHash = await hashPassword(password);
          if (passwordHash === offlineUser.passwordHash) {
            userData = offlineUser.userData;
            userToken = offlineUser.token;
            toast.success('Logged in offline mode', { icon: '📡' });
          }
        }
      }

      if (!userData) {
        if (!navigator.onLine) throw new Error('No offline credentials found. Please login online first.');
        else throw new Error('Invalid credentials');
      }
      
      if (userToken && userData) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', userToken);
        storage.setItem('user', JSON.stringify(userData));
        
        await AuditService.log('LOGIN', `User ${username} signed in ${navigator.onLine ? '' : '(Offline)'}`);
        
        const canRegister = window.PublicKeyCredential && 
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          
        const deviceRegistered = localStorage.getItem('biometricRegistered') === 'true';
        
        if (deviceRegistered) {
          localStorage.setItem('biometricUser', JSON.stringify(userData));
          localStorage.setItem('biometricAuth', btoa(password));
        }
        
        if (canRegister && !deviceRegistered) {
          setShowBiometricPrompt(true);
        } else {
          toast.success('Welcome back!');
          performRedirect(userData);
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
            <img 
              src="/icon.png?v=2" 
              alt="MsikaPos Icon" 
              className="w-full h-full object-contain" 
            />
          </motion.div>
          <div className="space-y-1">
            <div className="text-base font-black tracking-[0.2em] opacity-80">
              <BrandName />
            </div>
            <p className="text-[10px] font-medium text-muted-foreground/50 tracking-wide">— Run Your Shop. Grow Your Business —</p>
            <div className="w-16 h-1 bg-primary-500/10 mx-auto rounded-full mt-2"></div>
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

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative w-4 h-4 border-2 border-surface-border rounded flex items-center justify-center group-hover:border-primary-500 transition-colors">
                    <input 
                      type="checkbox" 
                      className="peer hidden" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                    />
                    <div className="w-2 h-2 bg-primary-500 rounded-sm scale-0 peer-checked:scale-100 transition-transform" />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-surface-text/30 group-hover:text-surface-text/60 transition-colors">Remember me</span>
                </label>
                <Link to="/staff/forgot-password" title="Forgot Password" className="text-[10px] font-black tracking-widest text-primary-500 hover:text-primary-400">Forgot password?</Link>
              </div>

              <button 
                title="Sign in"
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

              {isBiometricAvailable && (
                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setLoginMode('biometric')}
                    className="text-[10px] font-black tracking-widest text-primary-500 hover:text-primary-400 transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    <Fingerprint className="w-4 h-4" />
                    {localStorage.getItem('biometricRegistered') === 'true' ? 'Use Biometric Unlock' : 'Sign in with Fingerprint'}
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
              <h2 className="text-xl font-semibold tracking-tight mb-1">Biometric access</h2>
              <p className="text-[10px] text-muted-foreground/50 mb-8">Tap anywhere or the fingerprint to verify</p>

              {/* Tap the whole area or the button to trigger */}
              <div
                onClick={!loading ? handleBiometricLogin : undefined}
                className="flex flex-col items-center cursor-pointer select-none"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); if (!loading) handleBiometricLogin(); }}
                  disabled={loading}
                  className="group relative w-32 h-32 rounded-full bg-surface-bg border-4 border-surface-border flex items-center justify-center hover:border-primary-500/50 transition-all active:scale-90 overflow-hidden shadow-2xl"
                >
                  {loading && (
                    <motion.div 
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-4 border-transparent border-t-primary-500 rounded-full"
                    />
                  )}
                  <Fingerprint className={`w-12 h-12 transition-all ${loading ? 'text-primary-500 animate-pulse' : 'text-primary-500 group-hover:scale-110'}`} />
                </button>
                <p className="mt-4 text-[9px] text-muted-foreground/30">{loading ? 'Verifying...' : 'Touch sensor'}</p>
              </div>

              <div className="mt-12 space-y-4 w-full">
                <button 
                  onClick={() => setLoginMode('password')}
                  className="w-full h-14 flex items-center justify-center font-medium tracking-wide text-[10px] text-blue-500 hover:text-blue-600 hover:underline underline-offset-4 transition-all"
                >
                  Use password instead
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 flex flex-col items-center gap-6">


          <Link to="/about" className="md:hidden flex items-center justify-center gap-2 text-[10px] font-medium tracking-wide text-muted-foreground/60 hover:text-primary hover:underline underline-offset-4 transition-all">
            <Info className="w-3 h-3" />
            About <BrandName />
          </Link>


          <Link to="/about" className="hidden md:flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground/60 hover:text-primary hover:underline underline-offset-4 transition-colors">
            <Info className="w-3 h-3" />
            About <BrandName />
          </Link>

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
                  Enable biometric login
                </button>
                <button 
                  onClick={() => {
                    setShowBiometricPrompt(false);
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    performRedirect(user);
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

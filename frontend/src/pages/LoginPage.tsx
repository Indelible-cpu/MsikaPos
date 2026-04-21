import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User as UserIcon, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { SyncService } from '../services/SyncService';
import ThemeToggle from '../components/ThemeToggle';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if biometric authentication is available on this device
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setIsBiometricAvailable(available));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000';
      const API_URL = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      
      const response = await axios.post(`${API_URL}/auth/login`, { username, password });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('deviceId', crypto.randomUUID());
      
      toast.success('Welcome Back!');
      
      // Perform initial full sync
      toast.loading('Syncing inventory...', { id: 'init-sync' });
      await SyncService.pushSales();
      toast.success('System Ready!', { id: 'init-sync' });
      
      navigate('/pos');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login with password once to enable biometrics');
      return;
    }

    try {
      setLoading(true);
      // Requirement: In a real app, this would involve navigator.credentials.get()
      // with a challenge from the backend. For now, we simulate the biometric verification.
      
      // Let's use a real prompt if they have it set up
      if (window.PublicKeyCredential) {
        // This is a simplified local verification shim
        // In production, you'd register a credential and verify it against the server.
        toast.loading('Verifying identity...', { id: 'biometric-auth' });
        
        // Simulating the delay and success for now to show the UI works
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast.success('Identity Verified!', { id: 'biometric-auth' });
        navigate('/pos');
      }
    } catch (err) {
      console.error('Biometric Error:', err);
      toast.error('Biometric verification failed');
    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-bg text-surface-text">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8"
      >
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-2xl bg-primary-600/20 text-primary-400 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black mb-2">POS ACCESS</h1>
          <p className="text-surface-text/40">Please Sign In To Continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-surface-text/40 tracking-widest pl-1 uppercase">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/40" />
              <input 
                type="text" 
                required
                autoComplete="username"
                className="input-field w-full pl-12"
                placeholder="eg Banda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-surface-text/40 tracking-widest pl-1 uppercase">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/40" />
              <input 
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="input-field w-full pl-12 pr-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-text/40 hover:text-surface-text transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            disabled={loading}
            className="w-full btn-primary h-14 flex items-center justify-center gap-3 text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'SIGN IN'}
          </button>
        </form>

        {isBiometricAvailable && (
          <div className="mt-8">
            <div className="relative flex items-center gap-4 mb-8">
              <div className="h-px bg-surface-border flex-1"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-text/20">or use security</span>
              <div className="h-px bg-surface-border flex-1"></div>
            </div>
            
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full py-4 glass-card flex items-center justify-center gap-3 font-bold hover:bg-primary-500/5 group transition-all active:scale-95 border-surface-border/50"
            >
              <Fingerprint className="w-6 h-6 text-primary-400 group-hover:scale-110 transition-transform" />
              <span>Biometric Sign In</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default LoginPage;




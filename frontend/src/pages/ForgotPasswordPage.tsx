import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const ForgotPasswordPage: React.FC = () => {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone) return;

    setLoading(true);
    try {
      // Mocking the reset process for offline-first architecture
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast('Reset instructions sent if account exists', {
        icon: '📨',
      });
      
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      toast('Failed to request reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6 bg-surface-bg text-surface-text">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-8"
      >
        <Link to="/login" className="inline-flex items-center gap-2 text-surface-text/40 hover:text-primary-400 mb-8 transition-colors text-xs font-bold">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-sm font-black mb-1 text-primary-400">Forgot password</h1>
          <p className="text-surface-text/40 text-[10px] font-bold leading-relaxed">Enter your registered email or phone number to receive reset instructions</p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-surface-text/30 pl-1">Email or phone</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-text/40" />
              <input 
                type="text" 
                required
                className="input-field w-full pl-12"
                placeholder="e.g. 088... or mail@Vendrax.com"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xs"
          >
            {loading ? 'Sending request...' : 'Send reset link'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;

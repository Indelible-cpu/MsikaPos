import React, { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import Modal from './Modal';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, customer: any) => void;
}

const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // All logins/registrations now hit the unified backend
      const endpoint = isLogin ? '/customer/login' : '/customer/register';
      const res = await api.post(endpoint, formData);
      
      if (res.data.success) {
        // Shared token and user storage
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.customer));

        if (res.data.role === 'CUSTOMER') {
          onSuccess(res.data.token, res.data.customer);
          toast.success(isLogin ? 'Welcome back!' : 'Account created!');
          onClose();
        } else {
          // Staff member logged in via storefront (role-aware)
          toast.success(`Welcome ${res.data.role}, redirecting to portal...`);
          if (res.data.role === 'CASHIER') {
            window.location.href = '/staff/pos';
          } else {
            window.location.href = '/staff/dashboard';
          }
          onClose();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLogin ? 'Welcome Back' : 'Create Quick Account'}
      maxWidth="max-w-md"
    >
      <div className="p-8 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-surface-text/40">
            {isLogin ? 'Login to view your inquiries and chat with us.' : 'Just a username and password to start inquiring.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">FULL NAME</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
                <input 
                  type="text" 
                  required 
                  className="w-full py-4 pl-12 pr-4 bg-surface-bg border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm transition-all"
                  placeholder="John Doe"
                  value={formData.fullname}
                  onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">USERNAME</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
              <input 
                type="text" 
                required 
                className="w-full py-4 pl-12 pr-4 bg-surface-bg border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm transition-all"
                placeholder="pick_a_username"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black tracking-widest text-surface-text/30 ml-1">PASSWORD</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-text/20" />
              <input 
                type="password" 
                required 
                className="w-full py-4 pl-12 pr-4 bg-surface-bg border border-surface-border rounded-2xl outline-none focus:border-primary-500 font-bold text-sm transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary-500 text-white rounded-2xl font-black tracking-widest text-[11px] shadow-xl shadow-primary-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'SIGN IN' : 'CREATE ACCOUNT')}
          </button>
        </form>

        <div className="text-center pt-4">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] font-black tracking-widest text-primary-500 hover:underline"
          >
            {isLogin ? "DON'T HAVE AN ACCOUNT? REGISTER" : "ALREADY HAVE AN ACCOUNT? LOGIN"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CustomerAuthModal;

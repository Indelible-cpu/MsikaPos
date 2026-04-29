import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: (() => {
    const url = (import.meta.env.VITE_API_URL as string) || 'https://msikapos.onrender.com';
    if (url.endsWith('/api')) return url;
    if (url.endsWith('/')) return url + 'api';
    return url + '/api';
  })(),
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  const activeBranchId = localStorage.getItem('activeBranchId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  if (activeBranchId) {
    config.headers['x-branch-id'] = activeBranchId;
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith('/staff') && !window.location.pathname.includes('/login')) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/staff/login';
    }
    return Promise.reject(error);
  }
);

export default api;

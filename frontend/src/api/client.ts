import axios from 'axios';

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const activeBranchId = localStorage.getItem('activeBranchId');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (activeBranchId) {
    config.headers['x-branch-id'] = activeBranchId;
  }
  
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Public pages that do NOT require auth
      const publicPaths = ['/login', '/staff/login', '/store', '/', '/onboarding'];
      const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith('/store'));
      
      if (!isPublic) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('activeBranchId');
        window.location.href = '/staff/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

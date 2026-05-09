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
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const activeBranchId = localStorage.getItem('activeBranchId') || sessionStorage.getItem('activeBranchId');
  
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
    const { response, config } = error;
    
    if (response) {
      console.error(`❌ API Error [${response.status}] at ${config.url}:`, response.data?.message || response.data);
      
      if (response.status === 401) {
        // Public pages that do NOT require auth
        const publicPaths = ['/login', '/staff/login', '/store', '/', '/onboarding'];
        const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith('/store'));
        
        if (!isPublic) {
          window.dispatchEvent(new CustomEvent('auth:session-invalid', { 
            detail: { status: response.status, message: response.data?.message } 
          }));
        }
      } else if (response.status === 403) {
        console.warn('🚫 Permission Denied: You do not have access to this resource.');
      } else if (response.status === 404) {
        console.warn('🔍 Resource Not Found: The requested endpoint does not exist.');
      }
    } else {
      console.error('🌐 Network Error: Could not reach the server. Please check your connection or VITE_API_URL.');
    }
    return Promise.reject(error);
  }
);

export default api;

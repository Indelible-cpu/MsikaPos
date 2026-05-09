/**
 * Custom Error class for API responses
 */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  backoff?: number;
}

/**
 * Standardized API client using native fetch
 * Aligned with EduPayTrack patterns:
 * - Session Integrity (credentials: 'include')
 * - Exponential Backoff Retry Logic
 * - Structured ApiError
 * - Global Session Invalidation Event
 */
export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { 
    timeout = 30000, 
    retries = 3, 
    backoff = 1000,
    ...fetchOptions 
  } = options;

  const baseUrl = (import.meta.env.VITE_API_URL as string) || 'https://msikapos.onrender.com';
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${baseUrl.replace(/\/+$/, '')}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const activeBranchId = localStorage.getItem('activeBranchId');

  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (activeBranchId) {
    headers.set('x-branch-id', activeBranchId);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
        credentials: 'include', // Ensure cookies are included for session integrity
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        
        // Handle session invalidation
        if (response.status === 401 || response.status === 403) {
          const publicPaths = ['/login', '/staff/login', '/store', '/', '/onboarding'];
          const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith('/store'));
          
          if (!isPublic) {
            window.dispatchEvent(new CustomEvent('auth:session-invalid', { 
              detail: { status: response.status, message: errorData.message } 
            }));
          }
        }

        // Retry logic for specific errors
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        if (attempt < retries && retryableStatuses.includes(response.status)) {
          const waitTime = backoff * Math.pow(2, attempt);
          console.warn(`⚠️ API Request failed (${response.status}). Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        throw new ApiError(errorData.message || `API Error ${response.status}`, response.status, errorData);
      }

      return await response.json();
    } catch (error: unknown) {
      const err = error as Error;
      lastError = err;
      if (err.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      
      if (attempt < retries) {
        const waitTime = backoff * Math.pow(2, attempt);
        console.warn(`⚠️ Network error. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${retries})`, err.message);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}

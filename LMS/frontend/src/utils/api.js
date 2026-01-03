import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Log API URL on load for debugging
console.log('API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_URL: API_URL,
  Environment: import.meta.env.MODE
});

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Skip loading event for non-blocking calls if needed (e.g. notifications, auth check, whiteboard polling)
  const isBackgroundCall =
    config.skipLoader || // Allow manual opt-out
    config.url.includes('/notifications') ||
    config.url.includes('/auth/me') ||
    config.url.includes('/whiteboard');

  if (!isBackgroundCall) {
    window.dispatchEvent(new CustomEvent('loading-start'));
    // Attach flag to config so interceptor knows whether to fire loading-end
    config._showLoader = true;
  }

  console.log('API Interceptor: Sending request to', config.url, 'with Authorization header:', config.headers.Authorization ? 'present' : 'missing');
  return config;
});

// Handle token expiration and connection errors
api.interceptors.response.use(
  (response) => {
    if (response.config?._showLoader) {
      window.dispatchEvent(new CustomEvent('loading-end'));
    }
    return response;
  },
  (error) => {
    if (error.config?._showLoader) {
      window.dispatchEvent(new CustomEvent('loading-end'));
    }
    // Log connection errors for debugging
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Request timeout - Backend may be slow or unavailable:', error.config?.url);
      console.error('API URL being used:', API_URL);
    } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      console.error('Network error - Cannot reach backend:', error.config?.url);
      console.error('API URL being used:', API_URL);
      console.error('Check if backend is running and CORS is configured correctly');
    }

    if (error.response?.status === 401) {
      // Only redirect if not already on login page and not during token verification
      // Let AuthContext handle the logout/redirect logic to avoid conflicts
      const isAuthMeEndpoint = error.config?.url?.includes('/auth/me');
      if (!window.location.pathname.includes('/login') && !isAuthMeEndpoint) {
        // Only clear if it's not a token verification call (AuthContext will handle that)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('API: Authorization header set with token.');
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('API: Authorization header removed.');
  }
};

export default api;


import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('API Interceptor: Sending request to', config.url, 'with Authorization header:', config.headers.Authorization ? 'present' : 'missing');
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
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


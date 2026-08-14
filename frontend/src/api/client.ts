import axios from 'axios';
import { toast } from 'react-hot-toast';

// VITE_API_URL is injected by GitHub Actions for GitHub Pages
// In PROD on Render, it falls back to '/api' which uses the same origin
// In DEV, it falls back to 'http://localhost:3000/api'
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to inject the token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle auth errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Global error toast
    const errorMsg = error.response?.data?.error || 'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
    // Ignore 401 unauth errors from toast to avoid spamming on session expire
    if (error.response?.status !== 401) {
      toast.error(errorMsg);
    }

    return Promise.reject(error);
  }
);

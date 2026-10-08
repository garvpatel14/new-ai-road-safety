import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create base Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle errors or fallback mock responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend is unavailable, log graceful warning
    console.warn('API Service Network Intercept (Falling back to local state execution):', error.message);
    return Promise.reject(error);
  }
);

export default api;

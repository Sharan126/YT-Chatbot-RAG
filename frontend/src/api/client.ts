import axios from 'axios';

// Get base URL from environment or default to local backend
const getBaseUrl = (): string => {
  const customUrl = localStorage.getItem('ytcheck_custom_api_url');
  if (customUrl) return customUrl;
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
};

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s timeout for video indexing & LLM responses
});

// Dynamic baseURL per request
apiClient.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

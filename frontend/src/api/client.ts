import axios from 'axios';

// Get base URL from environment or default to local backend
const getBaseUrl = (): string => {
  // 1. User specified custom URL override
  const customUrl = localStorage.getItem('ytcheck_custom_api_url');
  if (customUrl) return customUrl;

  // 2. Production or hosted environment check (Render, Vercel, Railway, custom domain)
  // If app is running in browser and NOT on localhost/127.0.0.1, use relative origin ("")
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return '';
    }
  }

  // 3. Local dev environment variable or fallback to local FastAPI server
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:10000';
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

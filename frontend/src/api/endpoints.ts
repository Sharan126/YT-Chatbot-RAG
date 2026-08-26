import { apiClient } from './client';
import type {
  ProcessVideoResponse,
  AskQuestionResponse,
  BackendHealthStatus,
} from './types';

/**
 * Endpoint 1: Process Video
 * POST /process_video?url=...
 */
export async function processVideo(url: string): Promise<ProcessVideoResponse> {
  try {
    const response = await apiClient.post<ProcessVideoResponse>('/process_video', null, {
      params: { url },
    });
    return response.data;
  } catch (err: unknown) {
    let errorMessage = 'Network error or backend unavailable';
    let traceback: string | undefined = undefined;

    if (axiosIsAxiosError(err)) {
      if (err.response) {
        errorMessage = err.response.data?.error || `Server responded with status ${err.response.status}`;
        traceback = err.response.data?.traceback;
      } else if (err.request) {
        errorMessage = 'Unable to reach backend server. Check if FastAPI backend is running on port 8000.';
      } else {
        errorMessage = err.message;
      }
    }

    return { error: errorMessage, traceback };
  }
}

/**
 * Endpoint 2: Ask Question
 * POST /ask?question=...
 */
export async function askQuestion(question: string): Promise<AskQuestionResponse> {
  try {
    const response = await apiClient.post<AskQuestionResponse>('/ask', null, {
      params: { question },
    });
    return response.data;
  } catch (err: unknown) {
    let errorMessage = 'Network error or backend unavailable';
    let traceback: string | undefined = undefined;

    if (axiosIsAxiosError(err)) {
      if (err.response) {
        errorMessage = err.response.data?.error || `Server error ${err.response.status}`;
        traceback = err.response.data?.traceback;
      } else if (err.request) {
        errorMessage = 'Backend connection lost. Ensure server on port 8000 is online.';
      } else {
        errorMessage = err.message;
      }
    }

    return { error: errorMessage, traceback };
  }
}

/**
 * Backend Health & Connectivity Check
 */
export async function checkBackendHealth(): Promise<BackendHealthStatus> {
  const startTime = performance.now();
  try {
    await apiClient.options('/ask', { timeout: 4000 });
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      online: true,
      latencyMs,
      lastChecked: new Date().toLocaleTimeString(),
    };
  } catch {
    try {
      await apiClient.post('/ask', null, { params: { question: '' }, timeout: 4000 });
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        online: true,
        latencyMs,
        lastChecked: new Date().toLocaleTimeString(),
      };
    } catch (e: unknown) {
      if (axiosIsAxiosError(e) && e.response) {
        const latencyMs = Math.round(performance.now() - startTime);
        return {
          online: true,
          latencyMs,
          lastChecked: new Date().toLocaleTimeString(),
        };
      }
      return {
        online: false,
        message: 'Backend server not responding on port 8000',
        lastChecked: new Date().toLocaleTimeString(),
      };
    }
  }
}

function axiosIsAxiosError(error: unknown): error is { response?: { status: number; data?: { error?: string; traceback?: string } }; request?: unknown; message: string } {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error;
}

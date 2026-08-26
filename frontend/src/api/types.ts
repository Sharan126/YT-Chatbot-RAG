/**
 * YTCheck TypeScript API Contracts & Data Types
 * Exactly matches the Python FastAPI backend response schemas.
 */

export interface ProcessVideoParams {
  url: string;
}

export interface ProcessVideoSuccessResponse {
  message: string;
}

export interface ErrorResponse {
  error: string;
  traceback?: string;
}

export type ProcessVideoResponse = ProcessVideoSuccessResponse | ErrorResponse;

export interface AskQuestionParams {
  question: string;
}

export interface AskQuestionSuccessResponse {
  answer: string;
}

export type AskQuestionResponse = AskQuestionSuccessResponse | ErrorResponse;

export interface BackendHealthStatus {
  online: boolean;
  latencyMs?: number;
  message?: string;
  lastChecked?: string;
}


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
  errorDetails?: {
    message: string;
    traceback?: string;
  };
  durationMs?: number;
}

export interface ActiveVideoSession {
  videoId: string;
  url: string;
  title?: string;
  processedAt: string;
  chunksEstimated?: number;
  messages: ChatMessage[];
}

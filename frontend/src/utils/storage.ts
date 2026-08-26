import type { ActiveVideoSession } from '../api/types';

const HISTORY_STORAGE_KEY = 'ytcheck_session_history_v1';
const ACTIVE_SESSION_KEY = 'ytcheck_active_session_v1';

export function saveSessionToHistory(session: ActiveVideoSession): void {
  try {
    const existing = getSessionHistory();
    const filtered = existing.filter((s) => s.videoId !== session.videoId);
    const updated = [session, ...filtered].slice(0, 30); // Max 30 recent sessions
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save session history to localStorage', e);
  }
}

export function getSessionHistory(): ActiveVideoSession[] {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load session history from localStorage', e);
    return [];
  }
}

export function removeSessionFromHistory(videoId: string): ActiveVideoSession[] {
  try {
    const existing = getSessionHistory();
    const updated = existing.filter((s) => s.videoId !== videoId);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to remove session history from localStorage', e);
    return [];
  }
}

export function clearAllSessionHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear session history', e);
  }
}

export function saveActiveSession(session: ActiveVideoSession | null): void {
  try {
    if (session) {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to persist active session state', e);
  }
}

export function getActiveSession(): ActiveVideoSession | null {
  try {
    const data = localStorage.getItem(ACTIVE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to restore active session state', e);
    return null;
  }
}

import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UrlInputCard } from './components/UrlInputCard';
import { VideoInfoCard } from './components/VideoInfoCard';
import { ChatInterface } from './components/ChatInterface';
import { HistoryDrawer } from './components/HistoryDrawer';
import { processVideo, askQuestion } from './api/endpoints';
import type { ActiveVideoSession, ChatMessage } from './api/types';
import { extractVideoId } from './utils/youtube';
import {
  saveSessionToHistory,
  getSessionHistory,
  removeSessionFromHistory,
  clearAllSessionHistory,
  saveActiveSession,
  getActiveSession,
} from './utils/storage';

export function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'history'>('home');
  const [activeSession, setActiveSession] = useState<ActiveVideoSession | null>(getActiveSession());
  const [history, setHistory] = useState<ActiveVideoSession[]>(getSessionHistory());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [traceback, setTraceback] = useState<string | null>(null);

  // Sync active session changes to local storage
  useEffect(() => {
    saveActiveSession(activeSession);
    if (activeSession) {
      saveSessionToHistory(activeSession);
      setHistory(getSessionHistory());
    }
  }, [activeSession]);

  // Handle Process Video URL submission
  const handleProcessVideo = async (url: string): Promise<boolean> => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      setErrorMessage('Invalid YouTube URL format. Please paste a valid video, shorts, or embed link.');
      return false;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setTraceback(null);

    const response = await processVideo(url);
    setIsProcessing(false);

    if ('error' in response) {
      setErrorMessage(response.error);
      if (response.traceback) {
        setTraceback(response.traceback);
      }
      return false;
    }

    // Success! Create or update active video session
    const newSession: ActiveVideoSession = {
      videoId,
      url,
      processedAt: new Date().toISOString(),
      messages: [],
    };

    setActiveSession(newSession);
    setActiveTab('chat');
    return true;
  };

  // Handle Asking a Question to Backend LLM
  const handleSendMessage = async (questionText: string) => {
    if (!activeSession || isAsking) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: questionText,
      timestamp: new Date().toISOString(),
    };

    // Append user message immediately
    const updatedMessages = [...activeSession.messages, userMessage];
    const sessionWithUser = { ...activeSession, messages: updatedMessages };
    setActiveSession(sessionWithUser);
    setIsAsking(true);

    const startTime = performance.now();
    const response = await askQuestion(questionText);
    const durationMs = Math.round(performance.now() - startTime);
    setIsAsking(false);

    if ('error' in response) {
      const errorMessage: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: response.error,
        timestamp: new Date().toISOString(),
        isError: true,
        errorDetails: {
          message: response.error,
          traceback: response.traceback,
        },
        durationMs,
      };
      setActiveSession({
        ...sessionWithUser,
        messages: [...updatedMessages, errorMessage],
      });

      if (response.traceback) {
        setTraceback(response.traceback);
      }
      return;
    }

    // Success assistant response
    const assistantMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'assistant',
      content: response.answer,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    setActiveSession({
      ...sessionWithUser,
      messages: [...updatedMessages, assistantMessage],
    });
  };

  const handleResetSession = () => {
    setActiveSession(null);
    saveActiveSession(null);
    setActiveTab('home');
  };

  const handleDeleteHistoryItem = (videoId: string) => {
    const updated = removeSessionFromHistory(videoId);
    setHistory(updated);
    if (activeSession?.videoId === videoId) {
      handleResetSession();
    }
  };

  const handleClearHistory = () => {
    clearAllSessionHistory();
    setHistory([]);
    handleResetSession();
  };

  const handleSelectHistorySession = (session: ActiveVideoSession) => {
    setActiveSession(session);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasActiveVideo={Boolean(activeSession)}
        historyCount={history.length}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Tab 1: Home / Video Ingest View */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-in">
            <UrlInputCard
              onProcessVideo={handleProcessVideo}
              isProcessing={isProcessing}
              errorMessage={errorMessage}
              traceback={traceback}
              onClearError={() => {
                setErrorMessage(null);
                setTraceback(null);
              }}
              onSelectSample={(url) => handleProcessVideo(url)}
            />

            {/* If active video session exists, show shortcut banner */}
            {activeSession && (
              <div className="max-w-4xl mx-auto rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-cyan-400 animate-ping" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Active Video Session Ready</h4>
                    <p className="text-xs text-slate-300">
                      FAISS vector index loaded for video ID: <code className="font-mono text-cyan-300">{activeSession.videoId}</code>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20"
                >
                  Continue Q&A Chat →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Q&A Chat View */}
        {activeTab === 'chat' && (
          <div className="space-y-6 animate-fade-in">
            {activeSession ? (
              <>
                <VideoInfoCard
                  session={activeSession}
                  onResetSession={handleResetSession}
                  onAskPreset={(presetQ) => handleSendMessage(presetQ)}
                />
                <ChatInterface
                  messages={activeSession.messages}
                  onSendMessage={handleSendMessage}
                  isAsking={isAsking}
                />
              </>
            ) : (
              <div className="text-center py-16 space-y-4">
                <h3 className="text-xl font-bold text-white">No Active Video Session</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Please ingest a YouTube URL on the main page to create a vector index and begin asking questions.
                </p>
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-cyan-400 transition-colors"
                >
                  Go to Video Ingest
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Local History View */}
        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <HistoryDrawer
              history={history}
              onSelectSession={handleSelectHistorySession}
              onDeleteSession={handleDeleteHistoryItem}
              onClearHistory={handleClearHistory}
              onReIngest={(url) => {
                setActiveTab('home');
                handleProcessVideo(url);
              }}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>YTCheck — AI YouTube Video Intelligence & Vector RAG Platform</span>
          <span className="font-mono text-slate-400">FastAPI + FAISS + sentence-transformers + Groq LLM</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

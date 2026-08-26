import React, { useState } from 'react';
import {
  ArrowRight,
  Clipboard,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Cpu,
  Layers,
  FileText,
  Search,
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';
import { extractVideoId, SAMPLE_VIDEOS } from '../utils/youtube';

interface UrlInputCardProps {
  onProcessVideo: (url: string) => Promise<boolean>;
  isProcessing: boolean;
  errorMessage: string | null;
  traceback: string | null;
  onClearError: () => void;
  onSelectSample: (url: string) => void;
}

export const UrlInputCard: React.FC<UrlInputCardProps> = ({
  onProcessVideo,
  isProcessing,
  errorMessage,
  traceback,
  onClearError,
  onSelectSample,
}) => {
  const [url, setUrl] = useState('');
  const [showTraceback, setShowTraceback] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0);

  const videoId = extractVideoId(url);
  const isValidUrl = Boolean(videoId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isProcessing) return;

    onClearError();
    setProcessingStep(1); // Extracting ID

    // Simulated progress steps matching actual python backend workflow
    const timer1 = setTimeout(() => setProcessingStep(2), 700); // Fetching Transcript
    const timer2 = setTimeout(() => setProcessingStep(3), 1800); // Chunking & Sentence Embeddings
    const timer3 = setTimeout(() => setProcessingStep(4), 3200); // FAISS Indexing

    const success = await onProcessVideo(url.trim());

    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    setProcessingStep(0);

    if (success) {
      // Input retained or cleared based on UX preference
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        onClearError();
      }
    } catch {
      // Clipboard permission denied or unavailable
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="text-center space-y-3 pt-4 pb-2">
        <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-300">
          <Cpu className="h-3.5 w-3.5" />
          <span>FAISS Vector Retrieval + Groq LLM Architecture</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Analyze Any YouTube Video with AI
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400">
          Paste a YouTube link to extract its transcript, build a high-performance vector index, and ask instant questions in any language.
        </p>
      </div>

      {/* Primary Input Card */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-xl shadow-2xl glow-cyan transition-all">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative flex flex-col sm:flex-row items-center gap-2">
            <div className="relative w-full flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <YoutubeIcon className="h-5 w-5 text-rose-500" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (errorMessage) onClearError();
                }}
                disabled={isProcessing}
                placeholder="Paste YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-3.5 pl-11 pr-24 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              />
              {url ? (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  disabled={isProcessing}
                  className="absolute inset-y-0 right-12 flex items-center pr-2 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isProcessing}
                  className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  <Clipboard className="h-3.5 w-3.5 mr-1" />
                  Paste
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!isValidUrl || isProcessing}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Analyze Video</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Video ID preview pill */}
          {videoId && !isProcessing && (
            <div className="flex items-center space-x-2 text-xs text-emerald-400 pl-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Valid YouTube Video ID detected: <code className="font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded text-emerald-300">{videoId}</code></span>
            </div>
          )}
        </form>

        {/* Processing Workflow Progress */}
        {isProcessing && (
          <div className="mt-6 space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-cyan-300">
              <span className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Indexing Video Context with Backend RAG Pipeline...</span>
              </span>
              <span className="font-mono">{processingStep * 25}%</span>
            </div>

            {/* Stages */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className={`flex items-center space-x-2 rounded-lg p-2 text-xs border ${processingStep >= 1 ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
                <Search className="h-3.5 w-3.5" />
                <span>1. Verify URL</span>
              </div>
              <div className={`flex items-center space-x-2 rounded-lg p-2 text-xs border ${processingStep >= 2 ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
                <FileText className="h-3.5 w-3.5" />
                <span>2. Fetch Transcript</span>
              </div>
              <div className={`flex items-center space-x-2 rounded-lg p-2 text-xs border ${processingStep >= 3 ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
                <Layers className="h-3.5 w-3.5" />
                <span>3. Embed Chunks</span>
              </div>
              <div className={`flex items-center space-x-2 rounded-lg p-2 text-xs border ${processingStep >= 4 ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-slate-800 text-slate-500'}`}>
                <Cpu className="h-3.5 w-3.5" />
                <span>4. FAISS Index</span>
              </div>
            </div>
          </div>
        )}

        {/* Backend Error Banner */}
        {errorMessage && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-rose-300 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-200">Processing Error</h4>
                  <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button onClick={onClearError} className="text-rose-400 hover:text-rose-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {traceback && (
              <div className="pt-2 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={() => setShowTraceback(!showTraceback)}
                  className="text-xs font-mono text-rose-400 underline hover:text-rose-300"
                >
                  {showTraceback ? 'Hide Python Traceback' : 'Show Python Traceback'}
                </button>
                {showTraceback && (
                  <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs font-mono text-rose-300 overflow-x-auto border border-rose-900/50 max-h-48">
                    {traceback}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preset Sample Videos */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
          Or Try A Preset Sample Video
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_VIDEOS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setUrl(sample.url);
                onSelectSample(sample.url);
              }}
              disabled={isProcessing}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 transition-all hover:border-slate-700 hover:bg-slate-800/80 group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                  {sample.tag}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 group-hover:text-white">
                {sample.title}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                {sample.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

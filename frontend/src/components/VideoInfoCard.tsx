import React from 'react';
import {
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import type { ActiveVideoSession } from '../api/types';
import { getYoutubeThumbnailUrl, getYoutubeWatchUrl } from '../utils/youtube';

interface VideoInfoCardProps {
  session: ActiveVideoSession;
  onResetSession: () => void;
  onAskPreset: (question: string) => void;
}

export const VideoInfoCard: React.FC<VideoInfoCardProps> = ({
  session,
  onResetSession,
  onAskPreset,
}) => {
  const [copied, setCopied] = React.useState(false);
  const thumbnailUrl = getYoutubeThumbnailUrl(session.videoId);
  const watchUrl = getYoutubeWatchUrl(session.videoId);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(session.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleQuestions = [
    'Summarize the key points of this video.',
    'What are the main conclusions or takeaways?',
    'Explain the most technical concept discussed here.',
    'List all step-by-step instructions provided.',
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Video Info Thumbnail */}
        <div className="flex items-center space-x-4">
          <div className="relative group shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 w-28 h-20 sm:w-36 sm:h-24">
            <img
              src={thumbnailUrl}
              alt="YouTube Video Thumbnail"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Watch Video
            </a>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> FAISS Indexed
              </span>
              <span className="text-xs font-mono text-slate-400">ID: {session.videoId}</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">
              Active Video Session
            </h3>
            <p className="text-xs text-slate-400 line-clamp-1 font-mono">{session.url}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center space-x-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>

          <button
            onClick={onResetSession}
            className="inline-flex items-center space-x-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
            title="Reset active video index"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>New Video</span>
          </button>
        </div>
      </div>

      {/* Suggested Starter Questions */}
      <div className="pt-2 border-t border-slate-800/60">
        <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>Quick Suggested Prompts:</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onAskPreset(q)}
              className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300 transition-all hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-300"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

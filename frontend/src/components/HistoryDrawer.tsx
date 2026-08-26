import React, { useState } from 'react';
import {
  Clock,
  Search,
  Trash2,
  Play,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import type { ActiveVideoSession } from '../api/types';
import { getYoutubeThumbnailUrl } from '../utils/youtube';

interface HistoryDrawerProps {
  history: ActiveVideoSession[];
  onSelectSession: (session: ActiveVideoSession) => void;
  onDeleteSession: (videoId: string) => void;
  onClearHistory: () => void;
  onReIngest: (url: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  history,
  onSelectSession,
  onDeleteSession,
  onClearHistory,
  onReIngest,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = history.filter(
    (s) =>
      s.videoId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Analyzed Video History</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse previous YouTube video sessions saved locally. Re-index any video with one click.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="inline-flex items-center space-x-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      {history.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Video ID or URL..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      )}

      {/* History Items */}
      {filteredHistory.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-400 space-y-3">
          <Clock className="h-10 w-10 mx-auto text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-200">
            {history.length === 0 ? 'No Analyzed Videos Yet' : 'No Matching Videos Found'}
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            {history.length === 0
              ? 'Analyzed YouTube videos will automatically appear in your session history.'
              : 'Try searching for another YouTube URL or video ID.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((item) => (
            <div
              key={item.videoId}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/80 p-4 transition-all hover:border-slate-700 hover:bg-slate-900 space-y-3"
            >
              <div className="flex items-start space-x-3">
                <img
                  src={getYoutubeThumbnailUrl(item.videoId)}
                  alt="Video Thumbnail"
                  className="h-16 w-24 rounded-lg object-cover border border-slate-800 shrink-0"
                />
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-cyan-400">
                      ID: {item.videoId}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.processedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1 font-mono truncate">
                    {item.url}
                  </p>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <span className="flex items-center space-x-1">
                      <MessageSquare className="h-3 w-3 text-cyan-400" />
                      <span>{item.messages.length} Questions</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <button
                  onClick={() => onSelectSession(item)}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Resume Q&A</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onReIngest(item.url)}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
                    title="Re-index this video on backend"
                  >
                    <Play className="h-3 w-3 text-emerald-400" />
                    <span>Re-index</span>
                  </button>

                  <button
                    onClick={() => onDeleteSession(item.videoId)}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-900 transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

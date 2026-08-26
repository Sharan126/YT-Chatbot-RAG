import React from 'react';
import {
  Activity,
  Clock,
  Sparkles,
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';

interface HeaderProps {
  activeTab: 'home' | 'chat' | 'history';
  setActiveTab: (tab: 'home' | 'chat' | 'history') => void;
  hasActiveVideo: boolean;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasActiveVideo,
  historyCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('home')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <YoutubeIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">YTCheck</span>
            <p className="hidden text-xs text-slate-400 sm:block">AI YouTube Intelligence & Vector Chat</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'home'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Ingest</span>
          </button>

          {hasActiveVideo && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Q&A Chat</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                {historyCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};

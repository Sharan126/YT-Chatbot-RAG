import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Loader2,
  Clock,
  Languages,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../api/types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (question: string) => Promise<void>;
  isAsking: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isAsking,
}) => {
  const [inputQuestion, setInputQuestion] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAsking]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputQuestion.trim();
    if (!q || isAsking) return;

    setInputQuestion('');
    await onSendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[650px] max-h-[80vh] rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Chat Sub-header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-950/60">
        <div className="flex items-center space-x-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Interactive RAG Intelligence
            </h3>
            <p className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Languages className="h-3 w-3 text-cyan-400 inline" />
              <span>Answers in the exact language of your prompt</span>
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-xl glow-cyan">
              <Sparkles className="h-7 w-7" />
            </div>
            <h4 className="text-base font-semibold text-white">Ask Anything About This Video</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              The AI searches relevant video transcript chunks indexed in FAISS and synthesizes concise, accurate answers.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm shadow-md transition-all ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none'
                    : msg.isError
                    ? 'bg-rose-950/40 border border-rose-500/30 text-rose-200 rounded-bl-none'
                    : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between mb-1 text-[11px] opacity-75 border-b border-white/10 pb-1">
                  <span className="font-medium">
                    {msg.role === 'user' ? 'You' : 'YTCheck AI Assistant'}
                  </span>
                  <div className="flex items-center space-x-2">
                    {msg.durationMs && (
                      <span className="flex items-center text-slate-400 font-mono">
                        <Clock className="h-3 w-3 mr-0.5" />
                        {(msg.durationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Message Body */}
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : msg.isError ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-rose-300 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                    {msg.errorDetails?.traceback && (
                      <pre className="mt-2 p-2 bg-slate-950 rounded text-xs font-mono text-rose-400 overflow-x-auto border border-rose-900/40">
                        {msg.errorDetails.traceback}
                      </pre>
                    )}
                    <button
                      onClick={() => onSendMessage(messages[messages.indexOf(msg) - 1]?.content || '')}
                      className="mt-2 inline-flex items-center space-x-1 text-xs font-medium text-rose-300 hover:text-white underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Retry Question</span>
                    </button>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}

                {/* Action controls */}
                {msg.role === 'assistant' && !msg.isError && (
                  <div className="mt-3 flex items-center justify-end border-t border-slate-800/80 pt-2 text-xs">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center space-x-1 text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator when asking backend */}
        {isAsking && (
          <div className="flex items-start space-x-3 justify-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-none border border-cyan-500/20 bg-slate-950 p-4 text-slate-300 text-sm flex items-center space-x-3">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <span>Querying vector index & Groq LLM model...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Question Input Form */}
      <div className="border-t border-slate-800 bg-slate-950 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAsking}
            placeholder="Ask a question about the video... (Shift + Enter for new line)"
            className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/90 py-3 pl-4 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-h-32 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputQuestion.trim() || isAsking}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white transition-all hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20"
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

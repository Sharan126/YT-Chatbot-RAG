/**
 * YouTube Utility Functions
 * Regex matching backend rag_utils.py extract_video_id
 */

export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    // Standard watch URL
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Shorts
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // Embed
    /embed\/([a-zA-Z0-9_-]{11})/,
    // Live
    /live\/([a-zA-Z0-9_-]{11})/,
    // Timecodes or query params
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If user pasted raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }

  return null;
}

export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYoutubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export const SAMPLE_VIDEOS = [
  {
    title: 'Attention Is All You Need (Transformer Architecture)',
    url: 'https://www.youtube.com/watch?v=iDulhoQ2pro',
    description: 'Deep dive into transformer models and self-attention mechanisms.',
    tag: 'AI / ML',
  },
  {
    title: 'Python Fast API Crash Course',
    url: 'https://www.youtube.com/watch?v=tLKKmouUams',
    description: 'Building modern async web APIs with FastAPI & Pydantic.',
    tag: 'Web Dev',
  },
  {
    title: 'Vector Databases Explained in 10 Minutes',
    url: 'https://www.youtube.com/watch?v=klTvEwg3oJ4',
    description: 'Overview of embeddings, FAISS, ANN, and similarity search.',
    tag: 'RAG / Vector DB',
  },
];

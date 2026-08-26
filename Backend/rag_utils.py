from youtube_transcript_api import YouTubeTranscriptApi
import re
import json
import urllib.request
import yt_dlp
import faiss
import numpy as np
from groq import Groq
from sentence_transformers import SentenceTransformer
from config import GROQ_API_KEY, EMBED_MODEL, LLM_MODEL

import os
from dotenv import load_dotenv

def get_groq_client():
    load_dotenv(override=True)
    return Groq(api_key=os.getenv("GROQ_API_KEY"))

_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder

# 1. Extracting youtube video ID
def extract_video_id(url):
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    
    # 1. Direct 11-character Video ID
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
        return url

    patterns = [
        # Standard query param v=...
        r'[?&]v=([a-zA-Z0-9_-]{11})',
        # Shortened youtu.be/ID
        r'youtu\.be\/([a-zA-Z0-9_-]{11})',
        # Shorts
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        # Embed
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        # Live
        r'youtube\.com\/live\/([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None 

# 2. Fetching Video Transcripts (Dual-Engine: youtube-transcript-api + yt-dlp fallback)
def get_transcript(video_id):
    if not video_id:
        return None

    # Method 1: Try youtube_transcript_api
    try:
        ytt_api = YouTubeTranscriptApi()
        try:
            transcript_data = ytt_api.fetch(video_id, languages=["en"])
            full_text = " ".join(item["text"] if isinstance(item, dict) else item.text for item in transcript_data)
            if full_text and len(full_text.strip()) > 10:
                return re.sub(r"\s+", " ", full_text)
        except Exception:
            pass

        transcript_list = ytt_api.list(video_id)
        target_transcript = None
        for t in transcript_list:
            if not getattr(t, 'is_generated', True):
                target_transcript = t
                break
        if not target_transcript:
            target_transcript = next(iter(transcript_list))

        transcript_data = target_transcript.fetch()
        full_text = " ".join(item["text"] if isinstance(item, dict) else item.text for item in transcript_data)
        if full_text and len(full_text.strip()) > 10:
            return re.sub(r"\s+", " ", full_text)
    except Exception as e:
        print(f"youtube_transcript_api failed for video '{video_id}': {e}")

    # Method 2: Fallback to yt-dlp (Bypasses Cloud Datacenter IP blocking on Render)
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'quiet': True,
            'no_warnings': True
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subs = info.get('subtitles') or info.get('automatic_captions')
            if subs:
                lang = 'en' if 'en' in subs else next(iter(subs))
                formats = subs[lang]
                fmt = next((f for f in formats if f.get('ext') == 'json3'), formats[0])
                res = urllib.request.urlopen(fmt['url']).read().decode('utf-8')
                data = json.loads(res)
                lines = [ ''.join(s.get('utf8', '') for s in e.get('segs', [])).strip() for e in data.get('events', []) if 'segs' in e ]
                full_text = " ".join(l for l in lines if l)
                if full_text and len(full_text.strip()) > 10:
                    return re.sub(r"\s+", " ", full_text)
    except Exception as e:
        print(f"yt-dlp fallback failed for video '{video_id}': {e}")

    return None    
        
# 3. Splitting transcript into chunks
def split_text(text,chunk_size=150):
    words = text.split()
    return[
        " ".join(words[i:i + chunk_size])   
        for i in range(0, len(words), chunk_size)
    ]

# 4. Creating the Embeddings (create embeddings from the chunks)
def create_embeddings(text_list):
    embedder = get_embedder()
    embeddings = embedder.encode(text_list, convert_to_numpy=True)
    return np.array(embeddings).astype("float32")


# 5. Creating the Faiss Index (store embeddings in vector to search)
# FAISS - Fast Similarity Search on Vectors
def build_faiss_index(embeddings):
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension) #created faiss index
    index.add(embeddings) #add embeddings to index
    return index # return the index

# 6. Retrieving relevent chunks
def retreive_chunks(index, query_embedding, k=3):
    distances, indices = index.search(
        np.array([query_embedding]).astype("float32"), k
    )
    return [int(i) for i in indices[0] if i >= 0]

# 7. Asking LLM
def ask_llm(context, question):
    if not context.strip():
        return "Sorry, I couldn't find any relevant information in the Video Transcript"

    context = context[:6000]

    prompt = f"""
    Answer the user's question based on the following video transcript context:
    The Transcript may be in any language (Kannada, Telugu, Hindi, Tamil, English, etc).
    Always answer in the same language as the question.
    Context: 
    {context}
    Question: 
    {question}
    Answer Clearly : 
    """       
    # Calling LLM API
    client = get_groq_client()
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content
    







              



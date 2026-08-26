from youtube_transcript_api import YouTubeTranscriptApi
import re
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

# 2. Fetching Video Transcripts  
def get_transcript(video_id):
    if not video_id:
        return None
    try:
        ytt_api = YouTubeTranscriptApi()
        # Try direct fetch for English first
        try:
            transcript_data = ytt_api.fetch(video_id, languages=["en"])
            full_text = " ".join(item["text"] if isinstance(item, dict) else item.text for item in transcript_data)
            return re.sub(r"\s+", " ", full_text)
        except Exception:
            pass

        # Try listing all available transcripts for the video (any language / auto-generated)
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
        return re.sub(r"\s+", " ", full_text)
        
    except Exception as e:
        try:
            print(f"Transcript error for video '{video_id}': {e}")
        except Exception:
            pass
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
    







              



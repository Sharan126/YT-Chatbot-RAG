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
    patterns = [
        # Standard 
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        # Shorts
        r'(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})',
        # Embed
        r'embed\/([a-zA-Z0-9_-]{11})',
        # Live
        r'live\/([a-zA-Z0-9_-]{11})',
        # Timecodes (m=video id)
        r'[?&]v=([a-zA-Z0-9_-]{11})&'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None 

# 2.Fetching Video Transcripts  
def get_transcript(video_id):
    try:
        ytt_api = YouTubeTranscriptApi()
        try:
            transcript_data = ytt_api.fetch(video_id, languages=["en"])
        except Exception:
            transcript_list = ytt_api.list(video_id)
            transcript_data = next(iter(transcript_list)).fetch()
        full_text = " ".join(item["text"] if isinstance(item, dict) else item.text for item in transcript_data)
        return re.sub(r"\s+", " ", full_text)
        
    except Exception as e:
        try:
            print("Transcript error: ", e)
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
    







              



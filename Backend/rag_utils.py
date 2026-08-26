from youtube_transcript_api import YouTubeTranscriptApi
import re
import json
import urllib.request
import yt_dlp
from yt_dlp.utils import DownloadError
from typing import Any
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

import logging
import html
import tempfile
import time
import xml.etree.ElementTree as ET
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    VideoUnavailable, TranscriptsDisabled, NoTranscriptFound,
    IpBlocked, RequestBlocked, PoTokenRequired, YouTubeRequestFailed
)

logger = logging.getLogger("ytcheck.rag_utils")

def clean_transcript_text(raw_text):
    """Normalize raw caption strings into clean, formatted plain text."""
    if not raw_text:
        return ""
    text = html.unescape(raw_text)
    # Remove WEBVTT header and cue settings
    text = re.sub(r'^WEBVTT.*?\n\n', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove timestamps like 00:00:01.000 --> 00:00:04.000 align:start position:0%
    text = re.sub(r'\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?.*', '', text)
    # Remove cue metadata lines
    text = re.sub(r'^\d+\s*$', '', text, flags=re.MULTILINE)
    # Remove HTML/XML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Deduplicate repetitive consecutive lines (common in YouTube auto captions)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    dedup_lines = []
    for line in lines:
        if not dedup_lines or dedup_lines[-1] != line:
            dedup_lines.append(line)
    result = " ".join(dedup_lines)
    return re.sub(r'\s+', ' ', result).strip()

def parse_subtitle_payload(payload_str):
    """Parse JSON3, XML timedtext, WebVTT or SRT subtitle strings into clean text."""
    if not payload_str:
        return ""
    # Try JSON3 format
    if payload_str.strip().startswith('{'):
        try:
            data = json.loads(payload_str)
            events = data.get('events', [])
            raw_lines = []
            for ev in events:
                if 'segs' in ev:
                    seg_text = "".join(s.get('utf8', '') for s in ev['segs']).strip()
                    if seg_text:
                        raw_lines.append(seg_text)
            if raw_lines:
                return clean_transcript_text("\n".join(raw_lines))
        except Exception:
            pass
    # Try XML timedtext format (<transcript><text>...</text></transcript>)
    if '<transcript' in payload_str or '<text' in payload_str:
        try:
            root = ET.fromstring(payload_str)
            raw_lines = []
            for child in root.findall('.//text'):
                if child.text:
                    raw_lines.append(child.text)
            if raw_lines:
                return clean_transcript_text("\n".join(raw_lines))
        except Exception:
            pass
    # Fallback to WebVTT / Plaintext cleaning
    return clean_transcript_text(payload_str)

# 2. Fetching Video Transcripts with Multi-Strategy Fallback & Categorized Logging
def get_transcript_details(video_id, max_retries=2):
    """
    Extract transcript for video_id using multi-strategy fallbacks:
    1. youtube_transcript_api (manual/auto captions with lang fallback)
    2. yt-dlp in-memory subtitle extraction (multiple player_client settings)
    3. yt-dlp disk download in isolated temp directory (with auto-cleanup)
    4. Direct Innertube player API for captions

    Returns tuple: (transcript_text, status_category, user_error_message)
    """
    if not video_id or not isinstance(video_id, str):
        logger.error("Extraction failed: empty or invalid video ID type provided.")
        return None, "INVALID_ID", "Invalid YouTube URL or video ID format."
    video_id = video_id.strip()
    if not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        logger.error(f"Extraction failed: video ID '{video_id}' does not match standard 11-char format.")
        return None, "INVALID_ID", f"Invalid video ID format '{video_id}'."

    last_error_category = None
    last_user_error = None

    # Strategy 1: youtube_transcript_api multi-stage retrieval
    for attempt in range(max_retries):
        try:
            logger.info(f"[{video_id}] Strategy 1: Attempting youtube_transcript_api (attempt {attempt + 1})...")
            ytt = YouTubeTranscriptApi()
            preferred_langs = ['en', 'en-US', 'en-GB', 'en-CA', 'en-IN', 'en-AU']
            
            # Stage 1A: Preferred languages direct fetch
            try:
                data = ytt.fetch(video_id, languages=preferred_langs)
                snippets: list[str] = [str(getattr(item, 'text', item.get('text', ''))) if isinstance(item, dict) else str(getattr(item, 'text', str(item))) for item in data]
                clean_text = clean_transcript_text(" ".join(snippets))
                if clean_text and len(clean_text) > 10:
                    logger.info(f"[{video_id}] Strategy 1 (preferred fetch) succeeded: {len(clean_text)} chars")
                    return clean_text, "SUCCESS", None
            except (VideoUnavailable, TranscriptsDisabled, NoTranscriptFound, IpBlocked, RequestBlocked, PoTokenRequired):
                raise
            except Exception as e:
                logger.debug(f"[{video_id}] Strategy 1A preferred fetch failed: {e}")

            # Stage 1B: List transcripts & fallback selection
            transcript_list = ytt.list(video_id)
            selected = None

            # 1. Manual in preferred languages
            for t in transcript_list:
                if not getattr(t, 'is_generated', True) and getattr(t, 'language_code', '') in preferred_langs:
                    selected = t
                    break
            # 2. Auto-generated in preferred languages
            if not selected:
                for t in transcript_list:
                    if getattr(t, 'is_generated', False) and getattr(t, 'language_code', '') in preferred_langs:
                        selected = t
                        break
            # 3. Any manual transcript
            if not selected:
                for t in transcript_list:
                    if not getattr(t, 'is_generated', True):
                        selected = t
                        break
            # 4. Any available transcript
            if not selected:
                for t in transcript_list:
                    selected = t
                    break

            if selected:
                try:
                    if getattr(selected, 'language_code', '') not in preferred_langs and getattr(selected, 'is_translatable', False):
                        try:
                            selected = selected.translate('en')
                        except Exception:
                            pass
                    data = selected.fetch()
                    snippets: list[str] = [str(getattr(item, 'text', item.get('text', ''))) if isinstance(item, dict) else str(getattr(item, 'text', str(item))) for item in data]
                    clean_text = clean_transcript_text(" ".join(snippets))
                    if clean_text and len(clean_text) > 10:
                        logger.info(f"[{video_id}] Strategy 1 (list -> lang={getattr(selected, 'language_code', 'unknown')}) succeeded: {len(clean_text)} chars")
                        return clean_text, "SUCCESS", None
                except Exception as e:
                    logger.debug(f"[{video_id}] Fetching selected transcript failed: {e}")

        except VideoUnavailable as e:
            logger.warning(f"[{video_id}] youtube_transcript_api: VideoUnavailable ({e})")
            last_error_category = "VIDEO_UNAVAILABLE"
            last_user_error = f"Video '{video_id}' is unavailable, private, or deleted on YouTube. Please check if the video URL is correct and public."
            break  # Stop retry loop if video is non-existent/private
        except TranscriptsDisabled as e:
            logger.warning(f"[{video_id}] youtube_transcript_api: TranscriptsDisabled ({e})")
            last_error_category = "CAPTIONS_UNAVAILABLE"
            last_user_error = f"Captions and transcripts are disabled for video ID '{video_id}'."
            break
        except NoTranscriptFound as e:
            logger.warning(f"[{video_id}] youtube_transcript_api: NoTranscriptFound ({e})")
            last_error_category = "CAPTIONS_UNAVAILABLE"
            last_user_error = f"No transcript found for video ID '{video_id}' on YouTube."
            break
        except (IpBlocked, RequestBlocked, PoTokenRequired) as e:
            logger.warning(f"[{video_id}] youtube_transcript_api: IP Blocked / Anti-bot ({type(e).__name__})")
            last_error_category = "YOUTUBE_BLOCKED"
            last_user_error = "YouTube access was blocked or rate-limited by YouTube anti-bot protections. Please try again later."
        except YouTubeRequestFailed as e:
            logger.warning(f"[{video_id}] youtube_transcript_api: YouTubeRequestFailed ({e})")
            last_error_category = "NETWORK_FAILURE"
            last_user_error = "Network failure occurred while connecting to YouTube."
        except Exception as e:
            logger.warning(f"[{video_id}] youtube_transcript_api unexpected exception: {type(e).__name__}: {e}")
            last_error_category = "EXTRACTION_FAILURE"
            last_user_error = f"Failed to extract transcript for video ID '{video_id}'."

        if attempt < max_retries - 1 and last_error_category in ("YOUTUBE_BLOCKED", "NETWORK_FAILURE", "EXTRACTION_FAILURE"):
            time.sleep(1.0 * (attempt + 1))

    # Strategy 2: yt-dlp in-memory subtitle extraction (Dual-Engine Fallback)
    if last_error_category != "VIDEO_UNAVAILABLE":
        logger.info(f"[{video_id}] Strategy 2: Attempting yt-dlp in-memory subtitle extraction...")
        client_configs = [
            ['android', 'web', 'ios'],
            ['mweb', 'tvhtml5'],
            None
        ]
        for client_setting in client_configs:
            try:
                ydl_opts: dict[str, Any] = {
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'quiet': True,
                    'no_warnings': True,
                    'socket_timeout': 10,
                    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                }
                if client_setting:
                    ydl_opts['extractor_args'] = {'youtube': {'player_client': client_setting}}

                url = f"https://www.youtube.com/watch?v={video_id}"
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    subs = info.get('subtitles') or info.get('automatic_captions')
                    if subs:
                        lang = next((l for l in ['en', 'en-US', 'en-GB'] if l in subs), next(iter(subs)))
                        formats = subs[lang]
                        fmt = next((f for f in formats if f.get('ext') == 'json3'), next((f for f in formats if f.get('ext') == 'vtt'), formats[0]))
                        sub_url = fmt.get('url')
                        if sub_url:
                            req = urllib.request.Request(
                                sub_url,
                                headers={
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                    'Referer': 'https://www.youtube.com/'
                                }
                            )
                            with urllib.request.urlopen(req, timeout=10) as resp:
                                payload = resp.read().decode('utf-8', errors='ignore')
                                clean_text = parse_subtitle_payload(payload)
                                if clean_text and len(clean_text) > 10:
                                    logger.info(f"[{video_id}] Strategy 2 (yt-dlp in-memory) succeeded: {len(clean_text)} chars")
                                    return clean_text, "SUCCESS", None
            except DownloadError as e:
                err_msg = str(e)
                logger.warning(f"[{video_id}] yt-dlp DownloadError: {err_msg}")
                if any(term in err_msg for term in ["Video unavailable", "Private video", "deleted", "does not exist"]):
                    last_error_category = "VIDEO_UNAVAILABLE"
                    last_user_error = f"Video '{video_id}' is unavailable, private, or deleted on YouTube."
                    break
                elif "HTTP Error 429" in err_msg or "Too Many Requests" in err_msg or "Sign in to confirm" in err_msg:
                    last_error_category = "YOUTUBE_BLOCKED"
                    last_user_error = "YouTube access was blocked or rate-limited by YouTube anti-bot protections."
            except Exception as e:
                logger.warning(f"[{video_id}] yt-dlp in-memory attempt failed: {type(e).__name__}: {e}")

    # Strategy 3: yt-dlp subtitle download in isolated temporary directory (Auto-cleaned)
    if last_error_category not in ("VIDEO_UNAVAILABLE", "YOUTUBE_BLOCKED"):
        logger.info(f"[{video_id}] Strategy 3: Attempting yt-dlp disk download in temp directory...")
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                ydl_opts: dict[str, Any] = {
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'subtitlesformat': 'vtt/srt/json3/best',
                    'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
                    'quiet': True,
                    'no_warnings': True,
                    'socket_timeout': 10,
                }
                url = f"https://www.youtube.com/watch?v={video_id}"
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.extract_info(url, download=True)
                
                files = os.listdir(temp_dir)
                for f in files:
                    if any(f.endswith(ext) for ext in ['.vtt', '.srt', '.json3', '.ttml', '.srv1']):
                        filepath = os.path.join(temp_dir, f)
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as sub_f:
                            content = sub_f.read()
                            clean_text = parse_subtitle_payload(content)
                            if clean_text and len(clean_text) > 10:
                                logger.info(f"[{video_id}] Strategy 3 (yt-dlp temp file) succeeded: {len(clean_text)} chars")
                                return clean_text, "SUCCESS", None
        except Exception as e:
            logger.warning(f"[{video_id}] Strategy 3 failed: {type(e).__name__}: {e}")

    # Strategy 4: Innertube API player request for captions
    if last_error_category not in ("VIDEO_UNAVAILABLE", "YOUTUBE_BLOCKED"):
        logger.info(f"[{video_id}] Strategy 4: Attempting direct Innertube player API for captions...")
        try:
            url = "https://www.youtube.com/youtubei/v1/player"
            payload = {
                "context": {
                    "client": {
                        "clientName": "TVHTML5",
                        "clientVersion": "7.20240101.00.00",
                        "hl": "en",
                        "gl": "US"
                    }
                },
                "videoId": video_id
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                status = data.get('playabilityStatus', {}).get('status')
                reason = data.get('playabilityStatus', {}).get('reason', '')
                if status == "ERROR" and any(t in reason.lower() for t in ["unavailable", "private", "removed", "deleted"]):
                    return None, "VIDEO_UNAVAILABLE", f"Video '{video_id}' is unavailable, private, or deleted on YouTube. Please check if the video URL is correct and public."
                elif status in ("LOGIN_REQUIRED", "UNPLAYABLE") and "bot" in reason.lower():
                    return None, "YOUTUBE_BLOCKED", "YouTube access was blocked or rate-limited by YouTube anti-bot protections."
                
                tracks = data.get('captions', {}).get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])
                if tracks:
                    track_url = tracks[0].get('baseUrl')
                    if track_url:
                        t_req = urllib.request.Request(track_url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.youtube.com/'})
                        with urllib.request.urlopen(t_req, timeout=10) as t_resp:
                            t_payload = t_resp.read().decode('utf-8', errors='ignore')
                            clean_text = parse_subtitle_payload(t_payload)
                            if clean_text and len(clean_text) > 10:
                                logger.info(f"[{video_id}] Strategy 4 (Innertube player API) succeeded: {len(clean_text)} chars")
                                return clean_text, "SUCCESS", None
        except Exception as e:
            logger.warning(f"[{video_id}] Strategy 4 failed: {type(e).__name__}: {e}")

    if not last_error_category:
        last_error_category = "CAPTIONS_UNAVAILABLE"
        last_user_error = f"Captions/transcript are disabled or not available for video ID '{video_id}'."

    logger.error(f"[{video_id}] Final diagnosis: Category={last_error_category} | Error={last_user_error}")
    return None, last_error_category, last_user_error

def get_transcript(video_id):
    """Backwards-compatible wrapper returning transcript text or None."""
    text, category, _ = get_transcript_details(video_id)
    return text    
        
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
    







              



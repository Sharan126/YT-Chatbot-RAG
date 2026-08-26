# this file will runs the FastAPI Backend
import sys

# Ensure stdout and stderr handle UTF-8 characters on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi import FastAPI

from rag_utils import *
from rag_utils import extract_video_id

from fastapi.middleware.cors import CORSMiddleware

# Create FastAPI APP
app = FastAPI()

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Storage
chunks = []
index = None

# 1. Video Process EndPoint
@app.post("/process_video")
def process_video(url: str):
    global chunks, index

    video_id = extract_video_id(url)
    if not video_id:
        return {"error": "invalid url"}

    # Get Transcript
    text = get_transcript(video_id)
    if text is None:
        return {"error": "transcript not available for this video"}

    try:
        # Split Transcript into chunks
        chunks = split_text(text)

        # Create embeddings
        embeddings = create_embeddings(chunks)

        # Build Faiss index
        index = build_faiss_index(embeddings)

        return {"message": "Video processed successfully"}
    except Exception as e:
        import traceback
        print("Process video error:", e)
        return {"error": str(e), "traceback": traceback.format_exc()}

# 2. Question Endpoint
@app.post("/ask")
def ask(question: str):
    if index is None:
        return {"error": "Please Process a video first"}

    try:
        # Convert: query to embeddding
        query_embedding = create_embeddings([question])[0]

        # Retrieve Relevent Chunks
        top_chunks = retreive_chunks(index, query_embedding)
        if len(top_chunks) == 0:
            return {"error": "No relevant chunks found in the Video"}

            
        # Combine Context
        context_chunks = []
        for i in top_chunks:
            if 0 <= i < len(chunks):
                context_chunks.append(chunks[i])
            
        context = " ".join(context_chunks)

        print("Retrived chunks", top_chunks)
        try:
            print("Context preview", context[:300])
        except Exception:
            pass

        # Ask LLM
        answer = ask_llm(context, question)

        return {"answer": answer}

    except Exception as e:
        import traceback
        print("Ask error: ", e) 
        return {"error": str(e), "traceback": traceback.format_exc()}


# 3. Static Frontend Deployment (Serve built Vite React SPA)
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        target_file = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(frontend_dist, "index.html"))



    




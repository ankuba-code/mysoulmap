from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .atlas import PLACES

app = FastAPI(title="Soulmap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.mithertz.online"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "places_loaded": len(PLACES)}


@app.get("/atlas")
def get_atlas():
    return {"places": PLACES}


@app.post("/chat")
def chat():
    # Platzhalter – LLM-Anbindung folgt in Phase 1 (siehe OpenSpec-Plan)
    return {"message": "chat endpoint not yet implemented"}
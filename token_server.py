"""
Token server — Generates LiveKit room tokens for the web frontend.
Also serves the static web UI.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from livekit.api import AccessToken, VideoGrants

load_dotenv()

app = FastAPI(title="VoiceAgent Token Server")

# Serve static files
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    """Serve the voice agent web UI."""
    html_path = Path(__file__).parent / "static" / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/token")
async def get_token(room: str = "voice-agent-room", identity: str = "user"):
    """Generate a LiveKit access token for joining a room."""
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not api_key or not api_secret:
        return {"error": "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in .env"}

    token = (
        AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_grants(VideoGrants(
            room_join=True,
            room=room,
        ))
    )

    return {
        "token": token.to_jwt(),
        "url": os.getenv("LIVEKIT_URL", ""),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("token_server:app", host="127.0.0.1", port=8001, reload=True)

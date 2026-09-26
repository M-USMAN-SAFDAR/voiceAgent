"""
VoiceAgent — LiveKit voice pipeline agent.
Uses Deepgram STT/TTS + local Ollama qwen2.5:3b for conversational voice AI.
"""

import asyncio
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice import AgentSession, Agent
from livekit.plugins import deepgram, openai, silero

load_dotenv()


async def entrypoint(ctx: JobContext):
    """Called when a user joins the LiveKit room."""

    # Wait for the first participant to connect
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # ── Configure the voice pipeline components ─────────────────

    # 1. Voice Activity Detection (detects when user starts/stops speaking)
    vad = silero.VAD.load()

    # 2. Speech-to-Text (Deepgram Nova-2 — fast, accurate)
    stt = deepgram.STT(model="nova-2")

    # 3. LLM (local Ollama qwen2.5:3b via OpenAI-compatible API)
    model = openai.LLM.with_ollama(
        model="qwen2.5:3b",
    )

    # 4. Text-to-Speech (Deepgram Aura — low latency, natural voice)
    tts = deepgram.TTS(model="aura-asteria-en")

    # ── System prompt and Agent definition ──────────────────────
    agent = Agent(
        instructions=(
            "You are a friendly, helpful voice assistant called VoiceAgent. "
            "You're running locally on the user's machine using the qwen2.5:3b model. "
            "Keep your responses concise and conversational — you're speaking out loud, "
            "not writing an essay. Use short sentences. Be warm and natural. "
            "Avoid using markdown, bullet points, or code blocks since you are speaking. "
            "If you don't know something, say so honestly."
        ),
    )

    # ── Create and start the voice pipeline agent ───────────────
    session = AgentSession(
        vad=vad,
        stt=stt,
        llm=model,
        tts=tts,
    )

    # Start the agent session in the room
    await session.start(agent, room=ctx.room)

    # Greet the user
    await session.say(
        "Hey there! I'm VoiceAgent, your local AI assistant. How can I help you today?",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

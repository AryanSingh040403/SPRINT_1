from fastapi import (
    FastAPI,
    HTTPException,
    File,
    UploadFile,
    BackgroundTasks,
)

from fastapi.responses import FileResponse

from pydantic import BaseModel

from python_api.status_callback import LoloStatusCallback
from python_api.voice_service import voice_service
from python_api.tts_service import (
    tts_service,
    remove_file,
)

from scripts.agent_core import QwenLLMAgent


app = FastAPI(
    title="Lolo V4 AI API",
    version="1.0.0",
)

agent = None


class ChatRequest(BaseModel):
    message: str


class SpeechRequest(BaseModel):
    text: str


# --------------------------------------------------------------------------
# Startup
# --------------------------------------------------------------------------

@app.on_event("startup")
def startup_event():
    global agent

    print("🧠 Initializing Lolo AI Agent...")
    agent = QwenLLMAgent()
    print("✅ Lolo AI Agent ready.")


# --------------------------------------------------------------------------
# Health Check
# --------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Lolo Python AI",
        "agent_loaded": agent is not None,
    }


# --------------------------------------------------------------------------
# Chat Endpoint
# --------------------------------------------------------------------------

@app.post("/api/chat")
def chat(request: ChatRequest):
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Lolo agent is not initialized.",
        )

    try:
        callback_handler = LoloStatusCallback()

        result = agent.run(
            request.message,
            config={
                "callbacks": [callback_handler],
            },
        )

        return {
            "success": True,
            "response": result["output"],
        }

    except Exception as error:
        print(f"❌ Agent error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Failed to generate Lolo response.",
        )


# --------------------------------------------------------------------------
# Voice Transcription Endpoint
# --------------------------------------------------------------------------

@app.post("/api/voice/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...)
):
    try:
        audio_bytes = await audio.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="No audio data received.",
            )

        filename = (
            audio.filename or "audio.webm"
        )

        extension = (
            filename.rsplit(".", 1)[-1]
            if "." in filename
            else "webm"
        )

        transcript = voice_service.transcribe(
            audio_bytes,
            extension=extension,
        )

        return {
            "success": True,
            "transcript": transcript,
        }

    except HTTPException:
        raise

    except Exception as error:
        print(
            f"❌ Voice transcription error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to transcribe audio.",
        )


# --------------------------------------------------------------------------
# Text-to-Speech Endpoint
# --------------------------------------------------------------------------

@app.post("/api/voice/speak")
def speak_voice(
    request: SpeechRequest,
    background_tasks: BackgroundTasks,
):
    try:
        text = request.text.strip()

        if not text:
            raise HTTPException(
                status_code=400,
                detail="Text cannot be empty.",
            )

        print(
            f"👄 Generating speech for: {text}"
        )

        audio_path = tts_service.synthesize(
            text
        )

        background_tasks.add_task(
            remove_file,
            audio_path,
        )

        return FileResponse(
            audio_path,
            media_type="audio/wav",
            filename="lolo_response.wav",
        )

    except HTTPException:
        raise

    except Exception as error:
        print(
            f"❌ TTS generation error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to generate speech.",
        )


# --------------------------------------------------------------------------
# Startup Greeting Endpoint
# --------------------------------------------------------------------------

@app.get("/api/voice/greeting")
def generate_greeting():
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Lolo agent is not initialized.",
        )

    try:
        greeting = agent.generate_startup_greeting()

        return {
            "success": True,
            "greeting": greeting,
        }

    except Exception as error:
        print(
            f"❌ Greeting generation error: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to generate startup greeting.",
        )
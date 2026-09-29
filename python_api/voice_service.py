import os
import tempfile

from faster_whisper import WhisperModel

from scripts.realtime_agent import WHISPER_MODEL


class VoiceService:
    """Web adapter for the existing Faster-Whisper voice stack."""

    def __init__(self):
        print("🎤 Initializing web voice service...")

        self.stt = WhisperModel(
            WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
        )

        print("✅ Web voice service ready.")

    def transcribe(self, audio_bytes: bytes, extension: str = "webm") -> str:
        temp_path = None

        try:
            with tempfile.NamedTemporaryFile(
                suffix=f".{extension}",
                delete=False,
            ) as temp_file:
                temp_file.write(audio_bytes)
                temp_path = temp_file.name

            segments, _ = self.stt.transcribe(
                temp_path,
                beam_size=5,
            )

            text = "".join(
                segment.text
                for segment in segments
            ).strip()

            return text

        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)


voice_service = VoiceService()
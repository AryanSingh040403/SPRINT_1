import os
import tempfile

from TTS.api import TTS


TTS_MODEL = "tts_models/en/ljspeech/vits"


class TTSService:
    """Web adapter for the existing Coqui TTS voice stack."""

    def __init__(self):
        print("👄 Initializing web TTS service...")

        self.tts = TTS(
            model_name=TTS_MODEL,
            progress_bar=False,
        )

        print("✅ Web TTS service ready.")

    def synthesize(self, text: str) -> str:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty.")

        temp_file = tempfile.NamedTemporaryFile(
            suffix=".wav",
            delete=False,
        )

        output_path = temp_file.name
        temp_file.close()

        self.tts.tts_to_file(
            text=text.strip(),
            file_path=output_path,
        )

        return output_path


def remove_file(path: str) -> None:
    """Remove a generated temporary audio file."""
    if path and os.path.exists(path):
        os.remove(path)


tts_service = TTSService()
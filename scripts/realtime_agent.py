import time
import queue
import threading
import numpy as np
import sounddevice as sd
import re
import random
from faster_whisper import WhisperModel
from TTS.api import TTS
from agent_core import QwenLLMAgent

WHISPER_MODEL = "tiny.en" 
TTS_MODEL = "tts_models/en/ljspeech/vits"  
MIC_SAMPLE_RATE = 16000
CHANNELS = 1

audio_queue = queue.Queue()
sentence_queue = queue.Queue()
system_ready_event = threading.Event()

def record_audio():
    print("\n🎤 [Thread 1] Ear initialized. Waiting for Brain & Mouth to sync...")
    # Waits here so you don't talk over her greeting!
    system_ready_event.wait()

    while True:
        input("\n🟢 Press ENTER to start recording your question...")
        print("🎙️ Listening... (Press ENTER again to stop)")

        recording = []
        def callback(indata, frames, time, status):
            if status: print(status)
            recording.append(indata.copy())

        stream = sd.InputStream(
            samplerate=MIC_SAMPLE_RATE, channels=CHANNELS, callback=callback, dtype="float32"
        )
        with stream:
            input() 

        print("✅ Audio captured. Sending to Brain...")
        audio_data = np.concatenate(recording, axis=0).flatten()
        audio_queue.put(audio_data)

def process_intelligence():
    print("🧠 [Thread 2] Brain warming up...")
    stt = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    agent = QwenLLMAgent()
    print("🧠 [Thread 2] Models loaded and ready.")

    # 1. GENERATE GREETING AND QUEUE IT TO BE SPOKEN
    greeting = agent.generate_startup_greeting()
    sentence_queue.put(greeting) 
    
    # Unlock the microphone so you can reply
    system_ready_event.set()

    while True:
        audio_data = audio_queue.get() 
        start_time = time.time()
        segments, _ = stt.transcribe(audio_data, beam_size=5)
        user_text = "".join([segment.text for segment in segments]).strip()

        if not user_text:
            print("🧠 [Brain] Heard nothing. Try again.")
            continue

        print(f"\n🗣️ You said: '{user_text}'")

        # 2. IMMEDIATE ACKNOWLEDGMENT (Only if it's a real question)
        if len(user_text.split()) > 2 or "?" in user_text:
            acknowledgments = ["Let me check on that.", "Analyzing...", "Give me just a second to process that.", "I'm on it."]
            sentence_queue.put(random.choice(acknowledgments))

        print("🧠 [Brain] Thinking...")
        result = agent.run(user_text)
        response_text = result["output"]
        print(f"⏱️ Lolo generated response in {time.time() - start_time:.2f}s")

        sentences = re.split(r"(?<=[.!?]) +", response_text)
        for sentence in sentences:
            if sentence.strip():
                sentence_queue.put(sentence.strip())

def speak_audio():
    print("👄 [Thread 3] Mouth initializing...")
    tts = TTS(model_name=TTS_MODEL, progress_bar=False)
    print("👄 [Thread 3] Voice ready.")

    while True:
        sentence = sentence_queue.get() 
        print(f"\n👄 [Mouth] Speaking: {sentence}")
        wav = tts.tts(text=sentence)
        sd.play(wav, samplerate=22050) 
        sd.wait() 

if __name__ == "__main__":
    print("🚀 Booting Lolo V4 Real-Time Pipeline...")
    t1 = threading.Thread(target=record_audio, daemon=True)
    t2 = threading.Thread(target=process_intelligence, daemon=True)
    t3 = threading.Thread(target=speak_audio, daemon=True)

    t1.start()
    t2.start()
    t3.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Lolo V4.")
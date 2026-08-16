import os

# Keep unit/API tests fast and offline. Production default is still whisper.
os.environ.setdefault("SPEAKTEACH_DETECTOR", "mock")

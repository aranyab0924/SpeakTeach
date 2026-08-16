from __future__ import annotations

import io
import subprocess
import wave
from dataclasses import dataclass

import numpy as np

from app.core.errors import AnalyzeError
from app.ml.detector import AudioClip

TARGET_SAMPLE_RATE = 16_000
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIN_DURATION_SECONDS = 0.25
MAX_DURATION_SECONDS = 90.0
_FFMPEG_TIMEOUT_SECONDS = 30

_ALLOWED_CONTENT_TYPES = {
    "audio/webm",
    "video/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/ogg",
    "audio/opus",
    "audio/flac",
    "application/octet-stream",
}


@dataclass(frozen=True)
class PreprocessedAudio:
    clip: AudioClip
    content_type: str


def preprocess_audio(audio_bytes: bytes, content_type: str) -> PreprocessedAudio:
    """Validate upload and convert to normalized mono 16 kHz float32."""
    if not audio_bytes:
        raise AnalyzeError("Empty audio file")
    if len(audio_bytes) > MAX_UPLOAD_BYTES:
        raise AnalyzeError(
            f"Audio file is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)"
        )

    normalized_type = _normalize_content_type(content_type)
    if normalized_type not in _ALLOWED_CONTENT_TYPES and not _looks_like_wav(audio_bytes):
        raise AnalyzeError(
            "Unsupported audio type. Use webm, wav, mp3, m4a, or ogg."
        )

    samples = _decode_to_mono_16k(audio_bytes)
    samples = _peak_normalize(samples)
    duration_seconds = float(len(samples) / TARGET_SAMPLE_RATE)

    if duration_seconds < MIN_DURATION_SECONDS:
        raise AnalyzeError("Audio is too short to analyze")
    if duration_seconds > MAX_DURATION_SECONDS:
        raise AnalyzeError(
            f"Audio is too long (max {int(MAX_DURATION_SECONDS)} seconds)"
        )

    clip = AudioClip(
        samples=samples,
        sample_rate=TARGET_SAMPLE_RATE,
        duration_seconds=round(duration_seconds, 3),
    )
    return PreprocessedAudio(clip=clip, content_type=normalized_type)


def estimate_pause_ratio(clip: AudioClip) -> float:
    """Share of 30 ms frames whose energy is below a simple threshold (0–1)."""
    frame = int(clip.sample_rate * 0.03)
    if frame < 1 or len(clip.samples) < frame:
        return 0.0
    n_frames = len(clip.samples) // frame
    shaped = clip.samples[: n_frames * frame].reshape(n_frames, frame)
    rms = np.sqrt(np.mean(shaped**2, axis=1))
    thresh = max(float(np.median(rms) * 0.3), 1e-4)
    return round(float(np.mean(rms < thresh)), 3)


def _normalize_content_type(content_type: str) -> str:
    return (content_type or "application/octet-stream").split(";")[0].strip().lower()


def _looks_like_wav(audio_bytes: bytes) -> bool:
    return len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE"


def _decode_to_mono_16k(audio_bytes: bytes) -> np.ndarray:
    if _looks_like_wav(audio_bytes):
        try:
            return _decode_wav_pcm(audio_bytes)
        except (wave.Error, ValueError):
            pass
    return _decode_with_ffmpeg(audio_bytes)


def _decode_wav_pcm(audio_bytes: bytes) -> np.ndarray:
    with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        sample_rate = wav_file.getframerate()
        frame_count = wav_file.getnframes()
        raw = wav_file.readframes(frame_count)

    if sample_width != 2:
        raise ValueError("WAV is not 16-bit PCM")
    if channels < 1 or sample_rate < 1 or not raw:
        raise ValueError("Invalid WAV payload")

    pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        pcm = pcm.reshape(-1, channels).mean(axis=1)

    return _resample(pcm, sample_rate, TARGET_SAMPLE_RATE)


def _decode_with_ffmpeg(audio_bytes: bytes) -> np.ndarray:
    ffmpeg_bin = _ffmpeg_executable()
    command = [
        ffmpeg_bin,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "s16le",
        "-acodec",
        "pcm_s16le",
        "-ac",
        "1",
        "-ar",
        str(TARGET_SAMPLE_RATE),
        "pipe:1",
    ]
    try:
        completed = subprocess.run(
            command,
            input=audio_bytes,
            capture_output=True,
            timeout=_FFMPEG_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise AnalyzeError("Audio decoding timed out") from exc
    except FileNotFoundError as exc:
        raise AnalyzeError(
            "Could not decode audio. Install ffmpeg, or upload a 16-bit WAV file."
        ) from exc

    if completed.returncode != 0 or not completed.stdout:
        raise AnalyzeError("Could not decode audio. Use webm, wav, mp3, m4a, or ogg.")

    pcm = np.frombuffer(completed.stdout, dtype="<i2")
    if pcm.size == 0:
        raise AnalyzeError("Could not decode audio. Use webm, wav, mp3, m4a, or ogg.")
    return pcm.astype(np.float32) / 32768.0


def _ffmpeg_executable() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _resample(samples: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    if orig_sr == target_sr or samples.size == 0:
        return samples.astype(np.float32, copy=False)
    duration = samples.size / orig_sr
    target_n = max(int(round(duration * target_sr)), 1)
    old_x = np.linspace(0.0, duration, samples.size, endpoint=False)
    new_x = np.linspace(0.0, duration, target_n, endpoint=False)
    return np.interp(new_x, old_x, samples).astype(np.float32)


def _peak_normalize(samples: np.ndarray) -> np.ndarray:
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak <= 0.0:
        return samples.astype(np.float32, copy=False)
    return (samples / peak * 0.99).astype(np.float32)

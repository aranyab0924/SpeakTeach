"""Local ASR + timestamp heuristics for repetition and prolongation.

Uses faster-whisper word timestamps. This is practice feedback, not a diagnosis.

Whisper normally "cleans" stutters (the the → the). Decode settings below try
to keep those tokens. Heuristics then mark events from the word list.

Repetition
    Adjacent words that match ("the the"), a short prefix ("m" + "morning"),
    a hyphenated token ("I-I", "m-morning"), or a doubled token ("thethe").
    A short pause between repeats still counts (gap up to 1.5s).

Prolongation
    A word that is clearly long vs neighbors, or a held voiced stretch
    ≥ 0.85s. Borderline hits (confidence < 0.70) are dropped so they never
    reach the UI or feedback. Duration heuristic, not a clinical call.

Pauses are not events. They only affect pause_ratio in metrics.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import numpy as np

from app.core.errors import AnalyzeError
from app.ml.detector import AudioClip, DetectionResult, StutterDetector
from app.schemas.analysis import SpeechEvent, SpeechEventType

logger = logging.getLogger(__name__)

# faster-whisper FeatureExtractor.chunk_length is 30s. With vad_filter=False it
# only auto-accepts duration < 30; at/above that it raises unless we pass clips.
_WHISPER_CHUNK_SECONDS = 30.0
_WHISPER_WINDOW_SECONDS = 29.0

_MAX_REPEAT_GAP_SECONDS = 1.5
_PROLONGATION_MIN_SECONDS = 0.55
_PROLONGATION_MEDIAN_RATIO = 2.0
_PROLONGATION_HOLD_SECONDS = 0.85
_MIN_PROLONGATION_CONFIDENCE = 0.70
_HYPHEN_REPEAT = re.compile(r"^([a-z']{1,4})-\1$", re.IGNORECASE)


@dataclass(frozen=True)
class TimedWord:
    text: str
    start: float
    end: float
    probability: float = 1.0


class WhisperStutterDetector(StutterDetector):
    def __init__(self, model_size: str = "tiny.en") -> None:
        self._model_size = model_size
        self._model = None

    def detect(self, audio: AudioClip) -> DetectionResult:
        samples = np.ascontiguousarray(audio.samples, dtype=np.float32)
        if samples.ndim != 1 or samples.size == 0:
            return DetectionResult(events=[], transcript="")

        try:
            words = self._transcribe(samples, sample_rate=audio.sample_rate)
        except AnalyzeError:
            raise
        except Exception as exc:
            logger.exception("Whisper ASR failed")
            raise AnalyzeError(
                "Could not transcribe this recording. Try again or use a shorter clip.",
                status_code=422,
            ) from exc

        transcript = _transcript_from_words(words)
        repetitions = detect_repetitions(words)
        prolongations = [
            event
            for event in detect_prolongations(words, samples, audio.sample_rate)
            if not _overlaps_any(event, repetitions)
        ]
        events = repetitions + prolongations
        events.sort(key=lambda event: (event.start, event.end))
        numbered = [
            event.model_copy(update={"id": f"evt-{index}"})
            for index, event in enumerate(events, start=1)
        ]
        logger.info(
            "asr: %s | events: %s",
            " ".join(f"{w.text}[{w.start:.1f}-{w.end:.1f}]" for w in words) or "(none)",
            [(event.type.value, event.text) for event in numbered],
        )
        return DetectionResult(events=numbered, transcript=transcript)

    def _transcribe(self, samples: np.ndarray, sample_rate: int) -> list[TimedWord]:
        model = self._load_model()
        duration_seconds = float(samples.shape[0] / sample_rate) if sample_rate > 0 else 0.0
        transcribe_kwargs: dict = {
            "language": "en",
            "word_timestamps": True,
            "beam_size": 1,
            "temperature": 0.0,
            "vad_filter": False,
            "condition_on_previous_text": False,
            "repetition_penalty": 1.0,
            "no_repeat_ngram_size": 0,
        }
        # Keep full timeline (including pauses) without VAD; split long clips ourselves.
        if duration_seconds >= _WHISPER_CHUNK_SECONDS:
            transcribe_kwargs["clip_timestamps"] = clip_timestamps_for_duration(
                duration_seconds
            )

        segments, _info = model.transcribe(samples, **transcribe_kwargs)
        words: list[TimedWord] = []
        for segment in segments:
            for word in segment.words or []:
                text = (word.word or "").strip()
                if not text:
                    continue
                start = float(word.start)
                end = float(word.end)
                if end <= start:
                    end = start + 0.05
                words.append(
                    TimedWord(
                        text=text,
                        start=start,
                        end=end,
                        probability=float(getattr(word, "probability", 1.0) or 1.0),
                    )
                )
        return words

    def _load_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            try:
                self._model = WhisperModel(
                    self._model_size, device="cpu", compute_type="int8"
                )
            except Exception:
                logger.warning("int8 Whisper load failed; retrying with float32")
                self._model = WhisperModel(
                    self._model_size, device="cpu", compute_type="float32"
                )
        return self._model


def clip_timestamps_for_duration(duration_seconds: float) -> list[dict[str, float]]:
    """Fixed windows under Whisper's 30s chunk limit (seconds, for clip_timestamps)."""
    if duration_seconds <= 0:
        return [{"start": 0.0, "end": 0.0}]
    windows: list[dict[str, float]] = []
    start = 0.0
    while start < duration_seconds:
        end = min(start + _WHISPER_WINDOW_SECONDS, duration_seconds)
        windows.append({"start": round(start, 3), "end": round(end, 3)})
        if end >= duration_seconds:
            break
        start = end
    return windows


def detect_repetitions(words: list[TimedWord]) -> list[SpeechEvent]:
    events: list[SpeechEvent] = []
    used: set[int] = set()

    for index, word in enumerate(words):
        if _is_hyphen_stutter(word.text) or _is_doubled_word(word.text):
            events.append(
                _event(
                    SpeechEventType.repetition,
                    word.start,
                    word.end,
                    _confidence(word.probability, 0.8),
                    word.text,
                )
            )
            used.add(index)

    index = 0
    while index < len(words) - 1:
        if index in used:
            index += 1
            continue
        run = [index]
        while run[-1] + 1 < len(words):
            nxt = run[-1] + 1
            if nxt in used:
                break
            if not _is_adjacent_repeat(words[run[-1]], words[nxt]):
                break
            run.append(nxt)
        if len(run) >= 2:
            first = words[run[0]]
            last = words[run[-1]]
            text = " ".join(words[i].text for i in run)
            prob = min(words[i].probability for i in run)
            events.append(
                _event(
                    SpeechEventType.repetition,
                    first.start,
                    last.end,
                    _confidence(prob, 0.86),
                    text,
                )
            )
            used.update(run)
            index = run[-1] + 1
        else:
            index += 1
    return events


def detect_prolongations(
    words: list[TimedWord],
    samples: np.ndarray | None = None,
    sample_rate: int = 16_000,
) -> list[SpeechEvent]:
    if not words:
        return []
    durations = []
    for index, word in enumerate(words):
        stamped = max(word.end - word.start, 1e-3)
        limit = words[index + 1].start if index + 1 < len(words) else word.start + 2.0
        held = _voiced_duration(samples, sample_rate, word.start, min(limit, word.start + 2.0))
        durations.append(max(stamped, held))
    median = float(np.median(np.array(durations, dtype=np.float32)))
    events: list[SpeechEvent] = []
    for word, duration in zip(words, durations):
        if _is_hyphen_stutter(word.text) or _is_doubled_word(word.text):
            continue
        relative = (
            duration >= _PROLONGATION_MIN_SECONDS
            and duration >= _PROLONGATION_MEDIAN_RATIO * median
        )
        held_long = duration >= _PROLONGATION_HOLD_SECONDS
        if not relative and not held_long:
            continue
        confidence = _prolongation_confidence(duration, median)
        if confidence < _MIN_PROLONGATION_CONFIDENCE:
            continue
        events.append(
            _event(
                SpeechEventType.prolongation,
                word.start,
                word.start + duration,
                confidence,
                word.text,
            )
        )
    return events


def _transcript_from_words(words: list[TimedWord]) -> str:
    if not words:
        return ""
    parts: list[str] = []
    for word in words:
        token = word.text.strip()
        if not token:
            continue
        if parts and token[:1] in {",", ".", "?", "!", ";", ":"}:
            parts[-1] = parts[-1] + token
        else:
            parts.append(token)
    return " ".join(parts)


def _is_adjacent_repeat(left: TimedWord, right: TimedWord) -> bool:
    if right.start - left.end > _MAX_REPEAT_GAP_SECONDS:
        return False
    a = _normalize(left.text)
    b = _normalize(right.text)
    if not a or not b:
        return False
    if a == b:
        return True
    return 1 <= len(a) <= 3 and len(b) >= 4 and b.startswith(a)


def _is_hyphen_stutter(text: str) -> bool:
    raw = text.strip()
    if _HYPHEN_REPEAT.match(raw):
        return True
    if "-" not in raw:
        return False
    left, right = raw.split("-", 1)
    a = _normalize(left)
    b = _normalize(right)
    if not a or not b:
        return False
    if a == b:
        return True
    return 1 <= len(a) <= 3 and len(b) >= 4 and b.startswith(a)


def _is_doubled_word(text: str) -> bool:
    token = _normalize(text)
    if len(token) < 4 or len(token) % 2 != 0:
        return False
    half = len(token) // 2
    return half >= 2 and token[:half] == token[half:]


def _voiced_duration(
    samples: np.ndarray | None,
    sample_rate: int,
    start: float,
    limit: float,
) -> float:
    if samples is None or sample_rate <= 0 or limit <= start:
        return 0.0
    frame = max(int(sample_rate * 0.02), 1)
    i0 = max(int(start * sample_rate), 0)
    i1 = min(int(limit * sample_rate), int(samples.shape[0]))
    if i1 - i0 < frame:
        return 0.0
    thresh = 0.04
    last = start
    saw = False
    pos = i0
    while pos + frame <= i1:
        chunk = samples[pos : pos + frame]
        rms = float(np.sqrt(np.mean(np.square(chunk))))
        t = pos / float(sample_rate)
        if rms >= thresh:
            saw = True
            last = t + frame / float(sample_rate)
        elif saw:
            break
        pos += frame
    return (last - start) if saw else 0.0


def _overlaps_any(event: SpeechEvent, others: list[SpeechEvent]) -> bool:
    for other in others:
        if event.start < other.end and event.end > other.start:
            return True
    return False


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z']", "", text.strip().lower())


def _prolongation_confidence(duration: float, median: float) -> float:
    """How extreme the hold is — not Whisper's confidence that the word exists."""
    ratio = duration / median if median > 0 else 1.0
    over_ratio = max(ratio - _PROLONGATION_MEDIAN_RATIO, 0.0)
    over_hold = max(duration - _PROLONGATION_HOLD_SECONDS, 0.0)
    strength = max(over_ratio / 1.0, over_hold / 0.4)
    return round(min(0.62 + 0.25 * strength, 0.93), 3)


def _confidence(probability: float, floor: float) -> float:
    return round(min(max(max(float(probability), floor), 0.0), 1.0), 3)


def _event(
    event_type: SpeechEventType,
    start: float,
    end: float,
    confidence: float,
    text: str,
) -> SpeechEvent:
    return SpeechEvent(
        id="evt-0",
        type=event_type,
        start=round(start, 3),
        end=round(end, 3),
        confidence=confidence,
        text=text.strip(),
    )

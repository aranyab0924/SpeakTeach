import { buildTranscriptSpans } from "../services/results";
import type { SpeechEvent } from "../types/analysis";

type TranscriptDisplayProps = {
  transcript: string;
  events: SpeechEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
};

export function TranscriptDisplay({
  transcript,
  events,
  selectedEventId,
  onSelectEvent,
}: TranscriptDisplayProps) {
  const spans = buildTranscriptSpans(transcript, events);

  return (
    <section className="panel" aria-labelledby="transcript-heading">
      <h2 id="transcript-heading">Transcript</h2>
      {spans.length === 0 ? (
        <p className="muted">No transcript was returned for this recording.</p>
      ) : (
        <p className="transcript">
          {spans.map((span, index) => {
            const eventId = span.eventId;
            const type = span.type;
            if (!eventId || !type) {
              return <span key={`text-${index}`}>{span.text}</span>;
            }
            const selected = eventId === selectedEventId;
            return (
              <button
                key={eventId}
                type="button"
                className={`transcript-mark transcript-mark-${type}${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelectEvent(eventId)}
              >
                {span.text}
              </button>
            );
          })}
        </p>
      )}
    </section>
  );
}

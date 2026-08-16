import { eventTypeLabel, formatConfidence, formatSeconds } from "../services/results";
import type { SpeechEvent } from "../types/analysis";

type EventListProps = {
  events: SpeechEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
};

export function EventList({ events, selectedEventId, onSelectEvent }: EventListProps) {
  return (
    <section className="panel" aria-labelledby="events-heading">
      <h2 id="events-heading">Detected events</h2>
      {events.length === 0 ? (
        <p className="muted">No repetition or prolongation events were detected.</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => {
            const selected = event.id === selectedEventId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  className={`event-card event-card-${event.type}${selected ? " is-selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => onSelectEvent(event.id)}
                >
                  <span className="event-card-type">{eventTypeLabel(event.type)}</span>
                  <strong>{event.text || "Unmarked span"}</strong>
                  <span className="muted">
                    {formatSeconds(event.start)}–{formatSeconds(event.end)} · confidence{" "}
                    {formatConfidence(event.confidence)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

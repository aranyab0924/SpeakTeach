import { eventTypeLabel, formatSeconds } from "../services/results";
import type { SpeechEvent } from "../types/analysis";

type EventTimelineProps = {
  events: SpeechEvent[];
  durationSeconds: number;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
};

export function EventTimeline({
  events,
  durationSeconds,
  selectedEventId,
  onSelectEvent,
}: EventTimelineProps) {
  const duration = durationSeconds > 0 ? durationSeconds : 1;

  return (
    <section className="panel" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Timeline</h2>
      {events.length === 0 ? (
        <p className="muted">No repetition or prolongation events were marked on this timeline.</p>
      ) : (
        <>
          <div
            className="timeline"
            role="list"
            aria-label="Detected events along the recording"
          >
            <div className="timeline-track">
              {events.map((event) => {
                const left = (event.start / duration) * 100;
                const width = Math.max(((event.end - event.start) / duration) * 100, 1.5);
                const selected = event.id === selectedEventId;
                return (
                  <button
                    key={event.id}
                    type="button"
                    role="listitem"
                    className={`timeline-event timeline-event-${event.type}${selected ? " is-selected" : ""}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    aria-pressed={selected}
                    aria-label={`${eventTypeLabel(event.type)} at ${formatSeconds(event.start)}: ${event.text}`}
                    onClick={() => onSelectEvent(event.id)}
                  />
                );
              })}
            </div>
            <div className="timeline-axis">
              <span>0.0s</span>
              <span>{formatSeconds(durationSeconds)}</span>
            </div>
          </div>
          <p className="muted timeline-legend">
            <span className="legend-swatch legend-repetition" /> Repetition
            <span className="legend-swatch legend-prolongation" /> Prolongation
          </p>
        </>
      )}
    </section>
  );
}

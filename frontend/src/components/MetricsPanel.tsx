import { formatPauseRatio, formatSpeechRate, formatSeconds } from "../services/results";
import type { AnalysisMetrics } from "../types/analysis";

type MetricsPanelProps = {
  metrics: AnalysisMetrics;
  durationSeconds: number;
};

export function MetricsPanel({ metrics, durationSeconds }: MetricsPanelProps) {
  return (
    <section className="panel" aria-labelledby="metrics-heading">
      <h2 id="metrics-heading">Metrics</h2>
      <dl className="metrics-grid">
        <div>
          <dt>Duration</dt>
          <dd>{formatSeconds(durationSeconds)}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{metrics.total_events}</dd>
        </div>
        <div>
          <dt>Repetitions</dt>
          <dd>{metrics.repetitions}</dd>
        </div>
        <div>
          <dt>Prolongations</dt>
          <dd>{metrics.prolongations}</dd>
        </div>
        <div>
          <dt>Speech rate</dt>
          <dd>{formatSpeechRate(metrics.speech_rate)}</dd>
        </div>
        <div>
          <dt>Pause ratio</dt>
          <dd>{formatPauseRatio(metrics.pause_ratio)}</dd>
        </div>
      </dl>
    </section>
  );
}

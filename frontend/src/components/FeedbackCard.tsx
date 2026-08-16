import type { AnalysisFeedback } from "../types/analysis";

type FeedbackCardProps = {
  feedback: AnalysisFeedback;
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  return (
    <section className="panel" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">Feedback</h2>
      <p>{feedback.summary}</p>

      {feedback.strengths.length > 0 ? (
        <>
          <h3>What went well</h3>
          <ul>
            {feedback.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      {feedback.observations.length > 0 ? (
        <>
          <h3>What this recording showed</h3>
          <ul>
            {feedback.observations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Next step</h3>
      <p>{feedback.next_step}</p>
      <p className="muted">
        This feedback describes events detected in this recording. It does not diagnose a
        medical condition or replace a speech therapist.
      </p>
    </section>
  );
}

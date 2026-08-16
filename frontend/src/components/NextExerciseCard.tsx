import type { NextExerciseSuggestion } from "../services/results";

type NextExerciseCardProps = {
  suggestion: NextExerciseSuggestion | null;
  onSelectExercise: (exerciseId: string) => void;
};

export function NextExerciseCard({ suggestion, onSelectExercise }: NextExerciseCardProps) {
  if (!suggestion) {
    return null;
  }

  return (
    <section className="panel" aria-labelledby="next-exercise-heading">
      <h2 id="next-exercise-heading">Next exercise</h2>
      <p>
        <strong>{suggestion.exercise.title}</strong>
      </p>
      <p className="muted">{suggestion.exercise.prompt}</p>
      <p>{suggestion.reason}</p>
      <div className="button-row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSelectExercise(suggestion.exercise.id)}
        >
          Try this exercise
        </button>
      </div>
    </section>
  );
}

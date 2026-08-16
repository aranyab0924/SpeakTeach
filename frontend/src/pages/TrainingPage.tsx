import { EXERCISES, type Exercise } from "../data/exercises";

type HealthState = "checking" | "ok" | "error";

type TrainingPageProps = {
  health: HealthState;
  onSelectExercise: (exercise: Exercise) => void;
};

export function TrainingPage({ health, onSelectExercise }: TrainingPageProps) {
  return (
    <main className="page">
      <h1>Training</h1>
      <p>Pick an exercise, record yourself, then send the take for analysis.</p>
      <p className="muted">
        API health: <strong>{health}</strong>
        {health === "error"
          ? " — start the FastAPI server before sending a recording."
          : null}
      </p>

      <ul className="exercise-list">
        {EXERCISES.map((exercise) => (
          <li key={exercise.id}>
            <button
              type="button"
              className="exercise-card"
              onClick={() => onSelectExercise(exercise)}
            >
              <strong>{exercise.title}</strong>
              <span className="muted">{exercise.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

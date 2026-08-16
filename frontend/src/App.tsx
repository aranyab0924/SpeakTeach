import { useEffect, useState } from "react";
import { AuthProvider } from "./hooks/AuthProvider";
import { AppShell, type AppTab } from "./components/AppShell";
import type { Exercise } from "./data/exercises";
import { AccountPage } from "./pages/AccountPage";
import { ExercisePage } from "./pages/ExercisePage";
import { LogsPage } from "./pages/LogsPage";
import { TrainingPage } from "./pages/TrainingPage";
import { getHealth } from "./services/api";

type HealthState = "checking" | "ok" | "error";

function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [tab, setTab] = useState<AppTab>("training");
  const [selected, setSelected] = useState<Exercise | null>(null);

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((result) => {
        if (!cancelled) {
          setHealth(result.status === "ok" ? "ok" : "error");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealth("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleTabChange(next: AppTab): void {
    setTab(next);
  }

  return (
    <AuthProvider>
      <AppShell tab={tab} onTabChange={handleTabChange}>
      {tab === "training" && selected ? (
        <ExercisePage
          key={selected.id}
          exercise={selected}
          onBack={() => setSelected(null)}
          onSelectExercise={setSelected}
        />
      ) : null}
      {tab === "training" && !selected ? (
        <TrainingPage health={health} onSelectExercise={setSelected} />
      ) : null}
      {tab === "logs" ? (
        <LogsPage
          onGoToTraining={() => setTab("training")}
          onGoToAccount={() => setTab("account")}
        />
      ) : null}
      {tab === "account" ? (
        <AccountPage onGoToTraining={() => setTab("training")} />
      ) : null}
      </AppShell>
    </AuthProvider>
  );
}

export default App;

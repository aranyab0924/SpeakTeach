import { useEffect, useState } from "react";
import { getHealth } from "./services/api";

type HealthState = "checking" | "ok" | "error";

function App() {
  const [health, setHealth] = useState<HealthState>("checking");

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

  return (
    <main style={{ padding: "2rem", maxWidth: "40rem" }}>
      <h1>SpeakTeach</h1>
      <p>Foundation skeleton. Recorder, results, and auth are not built yet.</p>
      <p>
        API health: <strong>{health}</strong>
      </p>
    </main>
  );
}

export default App;

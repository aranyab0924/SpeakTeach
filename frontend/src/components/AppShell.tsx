import type { ReactNode } from "react";

export type AppTab = "training" | "logs" | "account";

const TABS: { id: AppTab; label: string }[] = [
  { id: "training", label: "Training" },
  { id: "logs", label: "Logs" },
  { id: "account", label: "Account" },
];

type AppShellProps = {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: ReactNode;
};

export function AppShell({ tab, onTabChange, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <p className="site-brand">SpeakTeach</p>
        <nav className="site-tabs" aria-label="Main">
          {TABS.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                className={selected ? "site-tab is-active" : "site-tab"}
                aria-current={selected ? "page" : undefined}
                onClick={() => onTabChange(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <div className="site-body">{children}</div>
    </div>
  );
}

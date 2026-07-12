"use client";

import type { TabKey } from "@/lib/types";

const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Tasks" },
  { key: "rewards", label: "Rewards" },
  { key: "stats", label: "Stats" },
];

export default function TabBar({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab${tab === t.key ? " active" : ""}`}
          aria-current={tab === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

"use client";

import type { TabKey } from "@/lib/types";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "home", label: "Tasks", icon: "🗓️" },
  { key: "rewards", label: "Rewards", icon: "🎁" },
  { key: "stats", label: "Stats", icon: "📈" },
];

export default function TabBar({
  tab,
  onChange,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <nav className="card tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab${tab === t.key ? " active" : ""}`}
          aria-current={tab === t.key}
          onClick={() => onChange(t.key)}
        >
          <span className="tab-ico" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

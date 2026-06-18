"use client";

import { useGame } from "@/lib/store";
import AuthControl from "@/components/AuthControl";

export default function TopBar() {
  const { state, level } = useGame();
  const pct = Math.round(level.progress * 100);

  return (
    <section className="card topbar">
      <div className="level-badge">
        <div className="level-chip">
          <small>LVL</small>
          {level.level}
        </div>
        <div className="xp-meta">
          <div className="xp-label">
            <span>XP</span>
            <span>
              {level.xpIntoLevel} / {level.xpForNext}
            </span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="coin-pill" title="Coins earned">
          <span className="coin-dot" />
          {state.coins.toLocaleString()}
        </div>
        <AuthControl />
      </div>
    </section>
  );
}

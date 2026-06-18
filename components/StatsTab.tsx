"use client";

import { useGame } from "@/lib/store";
import {
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
  buildTrack,
} from "@/lib/game";

function LevelRing({ progress, level }: { progress: number; level: number }) {
  const size = 132;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className="level-ring">
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-center">
        <div className="lvl-num">{level}</div>
        <div className="lvl-cap">Level</div>
      </div>
    </div>
  );
}

export default function StatsTab() {
  const { state, level } = useGame();
  const track = buildTrack(level.level);

  const maxByDiff = Math.max(
    1,
    ...DIFFICULTY_ORDER.map((d) => state.completedByDifficulty[d]),
  );

  return (
    <div>
      <section className="card hero">
        <LevelRing progress={level.progress} level={level.level} />
        <div className="hero-info">
          <h3>{Math.round(level.progress * 100)}% to Level {level.level + 1}</h3>
          <p>
            {level.xpForNext - level.xpIntoLevel} XP to go · {state.totalXp.toLocaleString()} total XP earned
          </p>
          <div className="bar">
            <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
        </div>
      </section>

      <div className="stat-grid">
        <div className="card stat-tile">
          <div className="stat-label">Total XP</div>
          <div className="stat-value gradient-text">
            {state.totalXp.toLocaleString()}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Coins</div>
          <div className="stat-value" style={{ color: "#fbbf24" }}>
            {state.coins.toLocaleString()}
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Tasks completed</div>
          <div className="stat-value">{state.tasksCompleted}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Current level</div>
          <div className="stat-value">{level.level}</div>
        </div>
      </div>

      <section className="card breakdown">
        <div className="section-head" style={{ margin: 0 }}>
          <h2>Completed by difficulty</h2>
        </div>
        {DIFFICULTY_ORDER.map((d) => {
          const meta = DIFFICULTY_META[d];
          const count = state.completedByDifficulty[d];
          const w = Math.round((count / maxByDiff) * 100);
          return (
            <div className="bd-row" key={d}>
              <span className="bd-label">
                {meta.glyph} {meta.label}
              </span>
              <span className="bd-track">
                <span
                  className="bd-fill"
                  style={{
                    width: `${count === 0 ? 4 : w}%`,
                    background: `var(--${meta.accent})`,
                  }}
                />
              </span>
              <span className="bd-count">{count}</span>
            </div>
          );
        })}
      </section>

      <section className="card track-wrap">
        <div className="section-head" style={{ marginBottom: 4 }}>
          <h2>Battle pass track</h2>
          <span className="muted">Unlocked {level.level} / {track.length}</span>
        </div>
        <div className="track">
          {track.map((tier) => (
            <div
              key={tier.level}
              className={`tier${tier.unlocked ? " unlocked" : ""}${
                tier.current ? " current" : ""
              }`}
            >
              <div className="tier-node">
                {tier.glyph}
                {!tier.unlocked && (
                  <span className="tier-lock" aria-hidden>
                    🔒
                  </span>
                )}
              </div>
              <div className="tier-label">LVL {tier.level}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

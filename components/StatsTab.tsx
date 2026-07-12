"use client";

import { useGame } from "@/lib/store";
import {
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
  PASS_TIERS,
  buildTrack,
} from "@/lib/game";
import {
  daysLeftInMonth,
  localDay,
  nextResetLabel,
  prevDay,
} from "@/lib/season";
import Meter from "@/components/Meter";

export default function StatsTab() {
  const { state, passLevel } = useGame();
  const track = buildTrack(passLevel.level);
  const passComplete = passLevel.level >= PASS_TIERS;

  // A streak is alive if it last advanced today or yesterday.
  const today = localDay();
  const streak =
    state.streakLastDay === today || state.streakLastDay === prevDay(today)
      ? state.streakCount
      : 0;
  const daysLeft = daysLeftInMonth();

  const maxByDiff = Math.max(
    1,
    ...DIFFICULTY_ORDER.map((d) => state.completedByDifficulty[d]),
  );

  return (
    <div>
      <section className="hero">
        <div className="hero-level">
          <div className="eyebrow">Tier</div>
          <div className="lvl-num">
            {String(passLevel.level).padStart(2, "0")}
          </div>
        </div>
        <div className="hero-info">
          <div className="xp-label">
            <span>
              {passComplete ? "Pass complete" : `To tier ${passLevel.level + 1}`}
            </span>
            <span>
              {passLevel.xpIntoLevel} / {passLevel.xpForNext} XP
            </span>
          </div>
          <Meter progress={passLevel.progress} cells={24} />
          <p>
            {passComplete
              ? `All ${PASS_TIERS} tiers cleared`
              : `${passLevel.xpForNext - passLevel.xpIntoLevel} XP to go`}{" "}
            · {state.totalXp.toLocaleString()} pass XP earned
          </p>
        </div>
      </section>

      <section className="track-wrap">
        <div className="section-head">
          <h2>Battle pass track</h2>
          <span className="muted">
            Tier {passLevel.level} / {track.length}
          </span>
        </div>
        <div className="track">
          {track.map((tier) => (
            <div
              key={tier.level}
              className={`tier${tier.unlocked ? " unlocked" : ""}${
                tier.current ? " current" : ""
              }`}
            >
              <span
                className="tier-node"
                title={tier.current ? `Tier ${tier.level} — current` : tier.reward}
              >
                {tier.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-label">Streak</div>
          <div className="stat-value">
            {streak}
            <span className="stat-sub">day{streak === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">BPs completed</div>
          <div className="stat-value">{state.passesCompleted}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Tasks completed</div>
          <div className="stat-value">
            {state.tasksCompleted.toLocaleString()}
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Days left</div>
          <div className="stat-value">
            {daysLeft}
            <span className="stat-sub">resets {nextResetLabel()}</span>
          </div>
        </div>
      </div>

      <section className="breakdown">
        <div className="section-head" style={{ margin: 0 }}>
          <h2>Completed by difficulty</h2>
        </div>
        {DIFFICULTY_ORDER.map((d) => {
          const meta = DIFFICULTY_META[d];
          const count = state.completedByDifficulty[d];
          const w = Math.round((count / maxByDiff) * 100);
          return (
            <div className="bd-row" key={d}>
              <span
                className="bd-label"
                style={{ color: `var(--${meta.accent})` }}
              >
                <span className="glyph">{meta.glyph}</span> {meta.label}
              </span>
              <span className="bd-track">
                <span
                  className="bd-fill"
                  style={{
                    width: `${w}%`,
                    background: `var(--${meta.accent})`,
                  }}
                />
              </span>
              <span className="bd-count">{count}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
}

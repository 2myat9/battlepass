"use client";

import { useGame } from "@/lib/store";
import { DIFFICULTY_META, DIFFICULTY_ORDER, buildTrack } from "@/lib/game";
import Meter from "@/components/Meter";

export default function StatsTab() {
  const { state, passLevel, accountLevel } = useGame();
  const track = buildTrack(passLevel.level);

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
            <span>To tier {passLevel.level + 1}</span>
            <span>
              {passLevel.xpIntoLevel} / {passLevel.xpForNext} XP
            </span>
          </div>
          <Meter progress={passLevel.progress} cells={24} />
          <p>
            {passLevel.xpForNext - passLevel.xpIntoLevel} XP to go ·{" "}
            {state.totalXp.toLocaleString()} pass XP earned
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
          <div className="stat-label">Pass XP</div>
          <div className="stat-value">{state.totalXp.toLocaleString()}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Coins</div>
          <div className="stat-value">
            <span className="gem" aria-hidden>
              ◆{" "}
            </span>
            {state.coins.toLocaleString()}
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Tasks completed</div>
          <div className="stat-value">{state.tasksCompleted}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Account level</div>
          <div className="stat-value">
            {accountLevel.level}
            <span className="stat-sub">
              {state.accountXp.toLocaleString()} XP
            </span>
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

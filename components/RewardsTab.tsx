"use client";

import { useGame } from "@/lib/store";
import { REWARDS } from "@/lib/game";

export default function RewardsTab() {
  const { state, redeem } = useGame();

  return (
    <div>
      <div className="section-head">
        <h2>Reward shop</h2>
        <span className="muted">{state.coins.toLocaleString()} coins available</span>
      </div>

      <div className="reward-grid">
        {REWARDS.map((r) => {
          const owned = state.purchases[r.id] ?? 0;
          const affordable = state.coins >= r.cost;
          return (
            <div
              key={r.id}
              className={`card reward-card${affordable ? "" : " locked"}`}
            >
              {owned > 0 && <span className="owned-tag">×{owned}</span>}
              <div className="reward-icon" aria-hidden>
                {r.icon}
              </div>
              <div className="reward-name">{r.name}</div>
              <div className="reward-desc">{r.description}</div>
              <div className="reward-foot">
                <span className="cost">
                  <span className="coin-dot" />
                  {r.cost}
                </span>
                <button
                  className="btn btn-buy"
                  disabled={!affordable}
                  onClick={() => redeem(r)}
                >
                  {affordable ? "Redeem" : "Locked"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

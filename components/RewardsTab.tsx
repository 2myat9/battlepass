"use client";

import { useGame } from "@/lib/store";
import AddRewardForm from "@/components/AddRewardForm";

export default function RewardsTab() {
  const { state, redeem, deleteReward } = useGame();
  // Stored order is insertion order; the shop always reads cheap -> expensive.
  const rewards = [...state.rewards].sort((a, b) => a.cost - b.cost);

  return (
    <div>
      <div className="section-head">
        <h2>Reward shop</h2>
        <span className="muted">
          ◆ {state.coins.toLocaleString()} available
        </span>
      </div>

      <AddRewardForm />

      {rewards.length === 0 ? (
        <div className="empty">No rewards yet — add one above.</div>
      ) : (
        <div className="reward-grid">
          {rewards.map((r) => {
            const owned = state.purchases[r.id] ?? 0;
            const affordable = state.coins >= r.cost;
            return (
              <div
                key={r.id}
                className={`reward-card${affordable ? "" : " locked"}`}
              >
                {owned > 0 && <span className="owned-tag">×{owned}</span>}
                <button
                  className="icon-btn"
                  onClick={() => deleteReward(r.id)}
                  aria-label={`Delete reward ${r.name}`}
                  title="Delete reward"
                >
                  ✕
                </button>
                <div className="reward-name">{r.name}</div>
                <div className="reward-desc">{r.description}</div>
                <div className="reward-foot">
                  <span className="cost">
                    <span className="gem" aria-hidden>
                      ◆
                    </span>
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
      )}
    </div>
  );
}

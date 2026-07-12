"use client";

import { useGame } from "@/lib/store";
import AuthControl from "@/components/AuthControl";
import Meter from "@/components/Meter";

export default function TopBar() {
  const { state, accountLevel } = useGame();

  return (
    <section className="topbar">
      <div className="level-stamp" title={`Account level ${accountLevel.level}`}>
        <small>LVL</small>
        <b>{accountLevel.level}</b>
      </div>

      <div className="xp-meta">
        <div className="xp-label">
          <span>Account XP</span>
          <span>
            {accountLevel.xpIntoLevel} / {accountLevel.xpForNext}
          </span>
        </div>
        <Meter progress={accountLevel.progress} />
      </div>

      <div className="topbar-right">
        <div className="coin-count" title="Coins earned">
          <span className="gem" aria-hidden>
            ◆
          </span>
          {state.coins.toLocaleString()}
        </div>
        <AuthControl />
      </div>
    </section>
  );
}

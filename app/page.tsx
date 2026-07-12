"use client";

import { useState } from "react";
import { GameProvider, useGame } from "@/lib/store";
import type { TabKey } from "@/lib/types";
import TopBar from "@/components/TopBar";
import TabBar from "@/components/TabBar";
import HomeTab from "@/components/HomeTab";
import RewardsTab from "@/components/RewardsTab";
import StatsTab from "@/components/StatsTab";
import Toasts from "@/components/Toasts";

function Header() {
  return (
    <header className="brand">
      <span className="brand-square" aria-hidden />
      <span className="brand-title">Battlepass</span>
      <span className="brand-sub">Level up your to-do list</span>
    </header>
  );
}

function ResetButton() {
  const { reset } = useGame();
  return (
    <div className="footer-actions">
      <button
        className="link-btn"
        onClick={() => {
          if (confirm("Reset all progress, XP, coins and tasks?")) reset();
        }}
      >
        Reset progress
      </button>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<TabKey>("home");
  return (
    <>
      <Header />
      <TopBar />
      <TabBar tab={tab} onChange={setTab} />
      <div className="tab-panel">
        {tab === "home" && <HomeTab />}
        {tab === "rewards" && <RewardsTab />}
        {tab === "stats" && <StatsTab />}
      </div>
      <ResetButton />
    </>
  );
}

export default function Page() {
  return (
    <GameProvider>
      <div className="app-shell">
        <main className="container">
          <Shell />
        </main>
        <Toasts />
      </div>
    </GameProvider>
  );
}

"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";

export default function AddRewardForm() {
  const { addReward } = useGame();
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");

  const parsedCost = Math.floor(Number(cost));
  const valid = name.trim().length > 0 && parsedCost >= 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addReward(name, parsedCost);
    setName("");
    setCost("");
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-row">
        <input
          className="text-input"
          placeholder="Add a reward…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          aria-label="Reward name"
        />
        <input
          className="text-input cost-input"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="Cost ◆"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          aria-label="Reward cost in coins"
        />
        <button className="btn btn-primary" type="submit" disabled={!valid}>
          Add
        </button>
      </div>
    </form>
  );
}

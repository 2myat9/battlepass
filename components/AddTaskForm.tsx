"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import { DIFFICULTY_META, DIFFICULTY_ORDER } from "@/lib/game";
import type { Difficulty } from "@/lib/types";

export default function AddTaskForm() {
  const { addTask } = useGame();
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addTask(title, difficulty);
    setTitle("");
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-row">
        <input
          className="text-input"
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          aria-label="Task title"
        />
        <button className="btn btn-primary" type="submit" disabled={!title.trim()}>
          Add
        </button>
      </div>

      <div className="segment">
        {DIFFICULTY_ORDER.map((d) => {
          const meta = DIFFICULTY_META[d];
          return (
            <button
              key={d}
              type="button"
              className="seg-btn"
              data-active={difficulty === d}
              style={{ ["--seg-accent" as string]: `var(--${meta.accent})` }}
              onClick={() => setDifficulty(d)}
            >
              <span>
                <span className="glyph">{meta.glyph}</span> {meta.label}
              </span>
              <span className="seg-reward">
                +{meta.xp} XP · +{meta.coins} ◆
              </span>
            </button>
          );
        })}
      </div>
    </form>
  );
}

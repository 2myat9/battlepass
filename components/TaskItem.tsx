"use client";

import { useGame } from "@/lib/store";
import { DIFFICULTY_META } from "@/lib/game";
import type { Task } from "@/lib/types";

export default function TaskItem({ task }: { task: Task }) {
  const { completeTask, deleteTask } = useGame();
  const meta = DIFFICULTY_META[task.difficulty];

  return (
    <div
      className={`card task${task.done ? " done" : ""}`}
      style={{ ["--task-accent" as string]: `var(--${meta.accent})` }}
    >
      <button
        className={`check${task.done ? " checked" : ""}`}
        onClick={() => completeTask(task)}
        disabled={task.done}
        aria-label={task.done ? "Completed" : "Complete task"}
        title={task.done ? "Completed" : "Complete task"}
      >
        {task.done ? "✓" : ""}
      </button>

      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span className="pill">
            {meta.glyph} {meta.label}
          </span>
          {!task.done && (
            <span className="reward-hint">
              +{meta.xp} XP · +{meta.coins} coins
            </span>
          )}
        </div>
      </div>

      <button
        className="icon-btn"
        onClick={() => deleteTask(task.id)}
        aria-label="Delete task"
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}

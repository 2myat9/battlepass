"use client";

import { useGame } from "@/lib/store";
import { DIFFICULTY_META } from "@/lib/game";
import type { Task } from "@/lib/types";

export default function TaskItem({ task }: { task: Task }) {
  const { completeTask, deleteTask } = useGame();
  const meta = DIFFICULTY_META[task.difficulty];
  const repeatable = !!task.repeatable;

  return (
    <div
      className={`task${task.done ? " done" : ""}`}
      style={{ ["--task-accent" as string]: `var(--${meta.accent})` }}
    >
      <button
        className={`check${task.done ? " checked" : ""}${repeatable ? " repeat" : ""}`}
        onClick={() => completeTask(task)}
        disabled={task.done}
        aria-label={
          repeatable ? "Complete again" : task.done ? "Completed" : "Complete task"
        }
        title={
          repeatable ? "Complete again" : task.done ? "Completed" : "Complete task"
        }
      >
        {repeatable ? "↻" : task.done ? "✓" : ""}
      </button>

      <div className="task-body">
        <div className="task-title-row">
          <div className="task-title">{task.title}</div>
          {repeatable && <span className="repeat-count">×{task.count ?? 0}</span>}
        </div>
        <div className="task-meta">
          <span className="pill">
            <span className="glyph">{meta.glyph}</span> {meta.label}
          </span>
          {!task.done && (
            <span className="reward-hint">
              +{meta.xp} XP · +{meta.coins} ◆
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

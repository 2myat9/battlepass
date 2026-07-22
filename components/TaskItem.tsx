"use client";

import { useGame } from "@/lib/store";
import { DIFFICULTY_META } from "@/lib/game";
import type { Task } from "@/lib/types";

export default function TaskItem({ task }: { task: Task }) {
  const { completeTask, togglePin, deleteTask } = useGame();
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

      {repeatable && <span className="repeat-count">×{task.count ?? 0}</span>}

      <button
        className={`icon-btn pin${task.pinned ? " pinned" : ""}`}
        onClick={() => togglePin(task.id)}
        aria-label={task.pinned ? "Unpin task" : "Pin task to top"}
        title={task.pinned ? "Unpin" : "Pin to top"}
      >
        {/* arrow-to-bar: send/keep at top */}
        <svg
          viewBox="0 0 16 16"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M4 3.5h8" />
          <path d="M8 13V6.5" />
          <path d="M5 9 8 6l3 3" />
        </svg>
      </button>

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

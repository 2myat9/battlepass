"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import AddTaskForm from "./AddTaskForm";
import TaskItem from "./TaskItem";

export default function HomeTab() {
  const { state, clearCompleted } = useGame();
  const [showDone, setShowDone] = useState(true);

  // Pinned tasks float to the top; sort is stable, so order within each
  // group (newest-first) is preserved.
  const active = state.tasks
    .filter((t) => !t.done)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const done = state.tasks.filter((t) => t.done);

  return (
    <div>
      <AddTaskForm />

      <div className="section-head">
        <h2>Active quests</h2>
        <span className="muted">
          {active.length} {active.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {active.length === 0 ? (
        <div className="empty">All clear. Add a task above to earn XP.</div>
      ) : (
        <div className="task-list">
          {active.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="collapse-row">
            <button
              className="collapse-head"
              onClick={() => setShowDone((v) => !v)}
            >
              <span>Completed · {done.length}</span>
              <span aria-hidden>{showDone ? "−" : "+"}</span>
            </button>
            <button
              className="icon-btn clear-done"
              onClick={clearCompleted}
              aria-label="Delete all completed tasks"
              title="Delete all completed tasks"
            >
              {/* trash can: lid, handle, body with ribs */}
              <svg
                viewBox="0 0 16 16"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M2.5 4h11" />
                <path d="M6 4V2.5h4V4" />
                <path d="M4 4v9.5h8V4" />
                <path d="M6.5 6.7v4.6M9.5 6.7v4.6" />
              </svg>
            </button>
          </div>
          {showDone && (
            <div className="task-list">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

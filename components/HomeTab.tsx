"use client";

import { useState } from "react";
import { useGame } from "@/lib/store";
import AddTaskForm from "./AddTaskForm";
import TaskItem from "./TaskItem";

export default function HomeTab() {
  const { state } = useGame();
  const [showDone, setShowDone] = useState(true);

  const active = state.tasks.filter((t) => !t.done);
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
          <button
            className="collapse-head"
            onClick={() => setShowDone((v) => !v)}
          >
            <span>Completed · {done.length}</span>
            <span>{showDone ? "−" : "+"}</span>
          </button>
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

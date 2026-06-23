import type { GameState, Task } from "./types";

export const STORAGE_KEY = "battlepass.state.v1";

export function sanitize(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<GameState>;
  if (!Array.isArray(s.tasks)) return null;
  return {
    tasks: s.tasks as Task[],
    totalXp: Number(s.totalXp) || 0,
    coins: Number(s.coins) || 0,
    tasksCompleted: Number(s.tasksCompleted) || 0,
    completedByDifficulty: {
      easy: Number(s.completedByDifficulty?.easy) || 0,
      medium: Number(s.completedByDifficulty?.medium) || 0,
      hard: Number(s.completedByDifficulty?.hard) || 0,
    },
    purchases: s.purchases && typeof s.purchases === "object" ? s.purchases : {},
  };
}

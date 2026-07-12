import { DIFFICULTY_META, DIFFICULTY_ORDER } from "./game";
import type { GameState, Task } from "./types";

export const STORAGE_KEY = "battlepass.state.v1";

export function sanitize(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<GameState>;
  if (!Array.isArray(s.tasks)) return null;
  const completedByDifficulty = {
    easy: Number(s.completedByDifficulty?.easy) || 0,
    medium: Number(s.completedByDifficulty?.medium) || 0,
    hard: Number(s.completedByDifficulty?.hard) || 0,
  };
  return {
    tasks: s.tasks as Task[],
    totalXp: Number(s.totalXp) || 0,
    // Blobs saved before the account/pass split carry no accountXp;
    // reconstruct it from the completion counts at today's rates.
    accountXp:
      s.accountXp == null
        ? DIFFICULTY_ORDER.reduce(
            (sum, d) =>
              sum + completedByDifficulty[d] * DIFFICULTY_META[d].accountXp,
            0,
          )
        : Number(s.accountXp) || 0,
    coins: Number(s.coins) || 0,
    tasksCompleted: Number(s.tasksCompleted) || 0,
    completedByDifficulty,
    purchases: s.purchases && typeof s.purchases === "object" ? s.purchases : {},
  };
}

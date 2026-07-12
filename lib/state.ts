import { DIFFICULTY_META, DIFFICULTY_ORDER, REWARDS } from "./game";
import type { GameState, Reward, Task } from "./types";

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
    // Saves that predate editable rewards get the default catalog.
    rewards: Array.isArray(s.rewards) ? (s.rewards as Reward[]) : REWARDS,
    purchases: s.purchases && typeof s.purchases === "object" ? s.purchases : {},
    // Pre-season saves carry none of these; a blank passSeason tells the
    // store to adopt the current month without resetting the pass XP.
    passSeason: typeof s.passSeason === "string" ? s.passSeason : "",
    passesCompleted: Number(s.passesCompleted) || 0,
    streakCount: Number(s.streakCount) || 0,
    streakLastDay: typeof s.streakLastDay === "string" ? s.streakLastDay : "",
  };
}

import type { Difficulty, Reward, Task } from "./types";

/* ------------------------------------------------------------------ *
 *  Difficulty rewards
 *  XP and coins scale exponentially with difficulty.
 *
 *  Every task pays into two separate XP pools:
 *    - `xp`        → battle-pass XP (GameState.totalXp), the fast track;
 *      scoped to the current monthly season.
 *    - `accountXp` → account XP (GameState.accountXp), one third of the
 *      pass rate, so the account level stays slow and uninflated.
 * ------------------------------------------------------------------ */

export interface DifficultyMeta {
  label: string;
  /** battle-pass experience awarded on completion */
  xp: number;
  /** account experience awarded on completion (reduced rate) */
  accountXp: number;
  /** currency awarded on completion */
  coins: number;
  /** short tally glyph — one bar per difficulty step */
  glyph: string;
  /** css custom-property accent name (see globals.css) */
  accent: string;
}

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: { label: "Easy", xp: 10, accountXp: 3, coins: 5, glyph: "▮", accent: "easy" },
  medium: { label: "Medium", xp: 30, accountXp: 10, coins: 20, glyph: "▮▮", accent: "medium" },
  hard: { label: "Hard", xp: 90, accountXp: 30, coins: 75, glyph: "▮▮▮", accent: "hard" },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

/* ------------------------------------------------------------------ *
 *  Account leveling curve
 *  XP required to clear a level grows exponentially. This is the
 *  lifetime progression: it never resets, and tasks pay it a third
 *  of the pass rate (see DIFFICULTY_META) so it stays uninflated.
 *  Call `levelInfo` with `accountXp`. The monthly battle pass uses
 *  the flat per-tier cost below instead.
 * ------------------------------------------------------------------ */

const BASE_XP = 100;
const GROWTH = 1.32;

/** XP required to advance FROM `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.floor(BASE_XP * Math.pow(GROWTH, level - 1));
}

/** Cumulative XP required to *reach* the start of `level`. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  /** 0..1 progress through the current level */
  progress: number;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let need = xpForLevel(level);
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = xpForLevel(level);
  }
  return {
    level,
    xpIntoLevel: remaining,
    xpForNext: need,
    progress: need === 0 ? 0 : remaining / need,
  };
}

/* ------------------------------------------------------------------ *
 *  Battle-pass tiers
 *  The pass is a monthly season — it resets on the 1st (the store's
 *  rollSeason handles the reset). Unlike the account curve above,
 *  every tier costs a flat PASS_TIER_XP so a month of steady play
 *  can clear all PASS_TIERS tiers; completing tier PASS_TIERS counts
 *  the pass as finished (GameState.passesCompleted).
 *
 *  Pacing: the target daily mix is 2 easy + 1 medium + 1 hard
 *  (2·10 + 30 + 90 = 140 pass XP), so a tier costs two average days
 *  (280 XP) and the full pass — 14 tier-ups, 3,920 XP — takes 28
 *  such days: finishable even in February, with slack in longer
 *  months.
 * ------------------------------------------------------------------ */

export const PASS_TIERS = 15;
export const PASS_TIER_XP = 280;

/** Tier progression for a season's pass XP. Caps at PASS_TIERS. */
export function passTierInfo(passXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(passXp));
  const maxXp = PASS_TIER_XP * (PASS_TIERS - 1);
  if (xp >= maxXp) {
    return {
      level: PASS_TIERS,
      xpIntoLevel: PASS_TIER_XP,
      xpForNext: PASS_TIER_XP,
      progress: 1,
    };
  }
  return {
    level: Math.floor(xp / PASS_TIER_XP) + 1,
    xpIntoLevel: xp % PASS_TIER_XP,
    xpForNext: PASS_TIER_XP,
    progress: (xp % PASS_TIER_XP) / PASS_TIER_XP,
  };
}

/* ------------------------------------------------------------------ *
 *  Battle-pass track (used by the Stats tab)
 * ------------------------------------------------------------------ */

export interface Tier {
  level: number;
  reward: string;
  unlocked: boolean;
  current: boolean;
}

export function buildTrack(currentLevel: number): Tier[] {
  return Array.from({ length: PASS_TIERS }, (_, i) => {
    const level = i + 1;
    return {
      level,
      reward: `Tier ${level}`,
      unlocked: level <= currentLevel,
      current: level === currentLevel,
    };
  });
}

/* ------------------------------------------------------------------ *
 *  Default reward catalog
 *  Only the seed: it fills GameState.rewards for new games and for
 *  saves that predate editable rewards. The user's own list lives in
 *  state and is managed from the Rewards tab (addReward/deleteReward).
 * ------------------------------------------------------------------ */

export const REWARDS: Reward[] = [
  { id: "playlist", name: "Fresh Playlist", description: "Curate a new set of focus tunes.", cost: 60 },
  { id: "coffee", name: "Coffee Break", description: "A well-earned hot drink, guilt-free.", cost: 90 },
  { id: "gaming", name: "30 min Gaming", description: "Half an hour of pure play.", cost: 150 },
  { id: "snack", name: "Tasty Snack", description: "Grab that thing you've been craving.", cost: 180 },
  { id: "movie", name: "Movie Night", description: "Dim the lights and press play.", cost: 280 },
  { id: "cheatmeal", name: "Cheat Meal", description: "Order in. You earned it.", cost: 360 },
  { id: "sleepin", name: "Sleep In", description: "No alarm tomorrow morning.", cost: 500 },
  { id: "shopping", name: "Treat Yourself", description: "Buy something small just because.", cost: 750 },
  { id: "dayoff", name: "Full Day Off", description: "A whole day with zero obligations.", cost: 1500 },
];

/* ------------------------------------------------------------------ *
 *  Seed data
 * ------------------------------------------------------------------ */

let idCounter = 0;
export function makeId(prefix = "t"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export const INITIAL_TASKS: Task[] = [
  { id: "seed_1", title: "Drink a glass of water", difficulty: "easy", done: false, createdAt: 1 },
  { id: "seed_2", title: "Tidy your desk for 5 minutes", difficulty: "easy", done: false, createdAt: 2 },
  { id: "seed_3", title: "Reply to that one email", difficulty: "medium", done: false, createdAt: 3 },
  { id: "seed_4", title: "30 minute focused work block", difficulty: "medium", done: false, createdAt: 4 },
  { id: "seed_5", title: "Finish the project milestone", difficulty: "hard", done: false, createdAt: 5 },
];

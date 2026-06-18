import type { Difficulty, Reward, Task } from "./types";

/* ------------------------------------------------------------------ *
 *  Difficulty rewards
 *  XP and coins scale exponentially with difficulty.
 * ------------------------------------------------------------------ */

export interface DifficultyMeta {
  label: string;
  /** experience awarded on completion */
  xp: number;
  /** currency awarded on completion */
  coins: number;
  /** short emoji glyph */
  glyph: string;
  /** css custom-property accent name (see globals.css) */
  accent: string;
}

export const DIFFICULTY_META: Record<Difficulty, DifficultyMeta> = {
  easy: { label: "Easy", xp: 10, coins: 5, glyph: "🌱", accent: "easy" },
  medium: { label: "Medium", xp: 30, coins: 20, glyph: "⚡", accent: "medium" },
  hard: { label: "Hard", xp: 90, coins: 75, glyph: "🔥", accent: "hard" },
};

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

/* ------------------------------------------------------------------ *
 *  Leveling curve
 *  XP required to clear a level grows exponentially.
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
 *  Battle-pass track (used by the Stats tab)
 * ------------------------------------------------------------------ */

const TRACK_REWARDS = ["🎖️", "💎", "🎁", "⭐", "👑", "🏆", "🚀", "🔮", "🪙", "🎉"];

export interface Tier {
  level: number;
  glyph: string;
  reward: string;
  unlocked: boolean;
  current: boolean;
}

export function buildTrack(currentLevel: number, length = 24): Tier[] {
  const span = Math.max(length, currentLevel + 4);
  return Array.from({ length: span }, (_, i) => {
    const level = i + 1;
    return {
      level,
      glyph: TRACK_REWARDS[i % TRACK_REWARDS.length],
      reward: `Tier ${level}`,
      unlocked: level <= currentLevel,
      current: level === currentLevel,
    };
  });
}

/* ------------------------------------------------------------------ *
 *  Reward shop catalog
 * ------------------------------------------------------------------ */

export const REWARDS: Reward[] = [
  { id: "playlist", name: "Fresh Playlist", description: "Curate a new set of focus tunes.", icon: "🎧", cost: 60 },
  { id: "coffee", name: "Coffee Break", description: "A well-earned hot drink, guilt-free.", icon: "☕", cost: 90 },
  { id: "gaming", name: "30 min Gaming", description: "Half an hour of pure play.", icon: "🎮", cost: 150 },
  { id: "snack", name: "Tasty Snack", description: "Grab that thing you've been craving.", icon: "🍫", cost: 180 },
  { id: "movie", name: "Movie Night", description: "Dim the lights and press play.", icon: "🍿", cost: 280 },
  { id: "cheatmeal", name: "Cheat Meal", description: "Order in. You earned it.", icon: "🍔", cost: 360 },
  { id: "sleepin", name: "Sleep In", description: "No alarm tomorrow morning.", icon: "😴", cost: 500 },
  { id: "shopping", name: "Treat Yourself", description: "Buy something small just because.", icon: "🛍️", cost: 750 },
  { id: "dayoff", name: "Full Day Off", description: "A whole day with zero obligations.", icon: "🏝️", cost: 1500 },
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

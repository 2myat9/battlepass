export type Difficulty = "easy" | "medium" | "hard";

export type TabKey = "home" | "rewards" | "stats";

export interface Task {
  id: string;
  title: string;
  difficulty: Difficulty;
  done: boolean;
  createdAt: number;
}

export interface Reward {
  id: string;
  name: string;
  /** only the seed catalog has blurbs; user-added rewards go without */
  description?: string;
  cost: number;
}

export interface GameState {
  tasks: Task[];
  /** battle-pass XP: tasks pay full XP here; drives the tier track.
   *  Belongs to one monthly season and resets when the month rolls. */
  totalXp: number;
  /** account XP: tasks pay a reduced rate here; drives the account
   *  level. Lifetime pool — never resets. */
  accountXp: number;
  coins: number;
  tasksCompleted: number;
  completedByDifficulty: Record<Difficulty, number>;
  /** the user's reward catalog; seeded from REWARDS, edited in the shop */
  rewards: Reward[];
  /** rewardId -> number of times redeemed */
  purchases: Record<string, number>;
  /** season the pass XP belongs to (local "YYYY-MM"); "" until stamped */
  passSeason: string;
  /** battle passes fully completed (final tier reached), all seasons */
  passesCompleted: number;
  /** consecutive days with at least one completed task */
  streakCount: number;
  /** local day ("YYYY-MM-DD") the streak last advanced; "" if never */
  streakLastDay: string;
}

export interface Toast {
  id: string;
  message: string;
  tone: "xp" | "coin" | "reward" | "warn";
}

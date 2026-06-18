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
  description: string;
  icon: string;
  cost: number;
}

export interface GameState {
  tasks: Task[];
  totalXp: number;
  coins: number;
  tasksCompleted: number;
  completedByDifficulty: Record<Difficulty, number>;
  /** rewardId -> number of times redeemed */
  purchases: Record<string, number>;
}

export interface Toast {
  id: string;
  message: string;
  tone: "xp" | "coin" | "reward" | "warn";
}

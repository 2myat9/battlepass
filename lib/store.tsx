"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  DIFFICULTY_META,
  INITIAL_TASKS,
  levelInfo,
  makeId,
  type LevelInfo,
} from "./game";
import type { Difficulty, GameState, Reward, Task, Toast } from "./types";

const STORAGE_KEY = "battlepass.state.v1";

const initialState: GameState = {
  tasks: INITIAL_TASKS,
  totalXp: 0,
  coins: 0,
  tasksCompleted: 0,
  completedByDifficulty: { easy: 0, medium: 0, hard: 0 },
  purchases: {},
};

type Action =
  | { type: "hydrate"; state: GameState }
  | { type: "addTask"; title: string; difficulty: Difficulty }
  | { type: "completeTask"; id: string }
  | { type: "deleteTask"; id: string }
  | { type: "redeem"; reward: Reward }
  | { type: "reset" };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "addTask": {
      const title = action.title.trim();
      if (!title) return state;
      const task: Task = {
        id: makeId(),
        title,
        difficulty: action.difficulty,
        done: false,
        createdAt: Date.now(),
      };
      return { ...state, tasks: [task, ...state.tasks] };
    }

    case "completeTask": {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task || task.done) return state;
      const meta = DIFFICULTY_META[task.difficulty];
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, done: true } : t,
        ),
        totalXp: state.totalXp + meta.xp,
        coins: state.coins + meta.coins,
        tasksCompleted: state.tasksCompleted + 1,
        completedByDifficulty: {
          ...state.completedByDifficulty,
          [task.difficulty]: state.completedByDifficulty[task.difficulty] + 1,
        },
      };
    }

    case "deleteTask":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case "redeem": {
      if (state.coins < action.reward.cost) return state;
      return {
        ...state,
        coins: state.coins - action.reward.cost,
        purchases: {
          ...state.purchases,
          [action.reward.id]: (state.purchases[action.reward.id] ?? 0) + 1,
        },
      };
    }

    case "reset":
      return {
        ...initialState,
        tasks: INITIAL_TASKS.map((t) => ({ ...t, done: false })),
      };

    default:
      return state;
  }
}

function sanitize(raw: unknown): GameState | null {
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

interface GameContextValue {
  state: GameState;
  level: LevelInfo;
  ready: boolean;
  toasts: Toast[];
  addTask: (title: string, difficulty: Difficulty) => void;
  completeTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  redeem: (reward: Reward) => boolean;
  reset: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load persisted state after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = sanitize(JSON.parse(raw));
        if (parsed) dispatch({ type: "hydrate", state: parsed });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable */
    }
  }, [state, ready]);

  const pushToast = useCallback((message: string, tone: Toast["tone"]) => {
    const id = makeId("toast");
    setToasts((prev) => [...prev, { id, message, tone }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 2600);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const addTask = useCallback(
    (title: string, difficulty: Difficulty) => {
      if (!title.trim()) return;
      dispatch({ type: "addTask", title, difficulty });
    },
    [],
  );

  const completeTask = useCallback(
    (task: Task) => {
      if (task.done) return;
      const meta = DIFFICULTY_META[task.difficulty];
      dispatch({ type: "completeTask", id: task.id });
      pushToast(`+${meta.xp} XP  ·  +${meta.coins} coins`, "xp");
    },
    [pushToast],
  );

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: "deleteTask", id });
  }, []);

  const redeem = useCallback(
    (reward: Reward): boolean => {
      if (state.coins < reward.cost) {
        pushToast(`Need ${reward.cost - state.coins} more coins`, "warn");
        return false;
      }
      dispatch({ type: "redeem", reward });
      pushToast(`Redeemed ${reward.name} ${reward.icon}`, "reward");
      return true;
    },
    [state.coins, pushToast],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    pushToast("Progress reset", "warn");
  }, [pushToast]);

  const level = useMemo(() => levelInfo(state.totalXp), [state.totalXp]);

  const value: GameContextValue = {
    state,
    level,
    ready,
    toasts,
    addTask,
    completeTask,
    deleteTask,
    redeem,
    reset,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}

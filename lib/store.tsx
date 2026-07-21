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
import { useSession } from "next-auth/react";
import {
  DIFFICULTY_META,
  INITIAL_TASKS,
  PASS_TIERS,
  REWARDS,
  levelInfo,
  makeId,
  passTierInfo,
  type LevelInfo,
} from "./game";
import { localDay, monthKey, prevDay } from "./season";
import {
  loadLocal,
  loadRemote,
  saveLocal,
  saveRemote,
} from "./state-repository";
import type { Difficulty, GameState, Reward, Task, Toast } from "./types";

const initialState: GameState = {
  tasks: INITIAL_TASKS,
  totalXp: 0,
  accountXp: 0,
  coins: 0,
  tasksCompleted: 0,
  completedByDifficulty: { easy: 0, medium: 0, hard: 0 },
  rewards: REWARDS,
  purchases: {},
  // "" (not the current month) keeps initialState deterministic for SSR;
  // rollSeason stamps the real month on the first hydrate/completion.
  passSeason: "",
  passesCompleted: 0,
  streakCount: 0,
  streakLastDay: "",
};

// Date-dependent actions carry their day/month so the reducer stays pure.
type Action =
  | { type: "hydrate"; state: GameState; month: string }
  | { type: "addTask"; title: string; difficulty: Difficulty; repeatable: boolean }
  | { type: "completeTask"; id: string; day: string }
  | { type: "deleteTask"; id: string }
  | { type: "redeem"; reward: Reward }
  | { type: "addReward"; name: string; cost: number }
  | { type: "deleteReward"; id: string }
  | { type: "reset" };

// A battle pass lasts one calendar month. On the first hydrate/completion in
// a new month, start the next season: pass XP resets, the tier track starts
// over. (Finished passes are tallied the moment the final tier is reached,
// not here.) A blank season — fresh installs and pre-season saves — adopts
// the current month without resetting.
function rollSeason(state: GameState, month: string): GameState {
  if (state.passSeason === month) return state;
  if (state.passSeason === "") return { ...state, passSeason: month };
  // New season: pass XP resets, and so do repeatable tasks' per-season counts.
  return {
    ...state,
    passSeason: month,
    totalXp: 0,
    tasks: state.tasks.map((t) => (t.count ? { ...t, count: 0 } : t)),
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate":
      return rollSeason(action.state, action.month);

    case "addTask": {
      const title = action.title.trim();
      if (!title) return state;
      const task: Task = {
        id: makeId(),
        title,
        difficulty: action.difficulty,
        done: false,
        createdAt: Date.now(),
        ...(action.repeatable ? { repeatable: true, count: 0 } : {}),
      };
      return { ...state, tasks: [task, ...state.tasks] };
    }

    case "completeTask": {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task || task.done) return state;
      // In case the app sat open across the 1st of the month.
      const rolled = rollSeason(state, action.day.slice(0, 7));
      const meta = DIFFICULTY_META[task.difficulty];
      const totalXp = rolled.totalXp + meta.xp;
      // Pass XP only grows within a season, so the final tier is crossed
      // at most once — safe to tally the finished pass right here.
      const finishedPass =
        passTierInfo(rolled.totalXp).level < PASS_TIERS &&
        passTierInfo(totalXp).level >= PASS_TIERS;
      // One streak step per day; a missed day restarts the run at 1.
      const streakCount =
        rolled.streakLastDay === action.day
          ? Math.max(rolled.streakCount, 1)
          : rolled.streakLastDay === prevDay(action.day)
            ? rolled.streakCount + 1
            : 1;
      return {
        ...rolled,
        // Repeatable tasks stay open and tally a completion; the rest check off.
        tasks: rolled.tasks.map((t) =>
          t.id === action.id
            ? t.repeatable
              ? { ...t, count: (t.count ?? 0) + 1 }
              : { ...t, done: true }
            : t,
        ),
        totalXp,
        accountXp: rolled.accountXp + meta.accountXp,
        coins: rolled.coins + meta.coins,
        tasksCompleted: rolled.tasksCompleted + 1,
        completedByDifficulty: {
          ...rolled.completedByDifficulty,
          [task.difficulty]: rolled.completedByDifficulty[task.difficulty] + 1,
        },
        passesCompleted: rolled.passesCompleted + (finishedPass ? 1 : 0),
        streakCount,
        streakLastDay: action.day,
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

    case "addReward": {
      const name = action.name.trim();
      const cost = Math.floor(action.cost);
      if (!name || !Number.isFinite(cost) || cost < 1) return state;
      const reward: Reward = { id: makeId("r"), name, cost };
      return { ...state, rewards: [...state.rewards, reward] };
    }

    case "deleteReward":
      return {
        ...state,
        rewards: state.rewards.filter((r) => r.id !== action.id),
      };

    case "reset":
      return {
        ...initialState,
        tasks: INITIAL_TASKS.map((t) => ({ ...t, done: false })),
      };

    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  /** battle-pass tier progression for the current monthly season */
  passLevel: LevelInfo;
  /** account level progression (reduced task XP) */
  accountLevel: LevelInfo;
  ready: boolean;
  toasts: Toast[];
  addTask: (title: string, difficulty: Difficulty, repeatable?: boolean) => void;
  completeTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  redeem: (reward: Reward) => boolean;
  addReward: (name: string, cost: number) => void;
  deleteReward: (id: string) => void;
  reset: () => void;
}

// True when the state holds real progress (vs. the pristine seed). Used to avoid
// claiming an empty seed onto the server, which "server wins" could later replay
// over genuine progress.
function hasProgress(s: GameState): boolean {
  return (
    s.totalXp > 0 ||
    s.tasksCompleted > 0 ||
    Object.keys(s.purchases).length > 0 ||
    s.tasks.length !== INITIAL_TASKS.length ||
    s.rewards.length !== REWARDS.length
  );
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { status } = useSession();
  const stateRef = useRef(state);
  const remoteReady = useRef(false);

  // Keep a ref to the latest state for async sync callbacks.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load locally-persisted state after mount (instant; avoids SSR mismatch).
  useEffect(() => {
    const local = loadLocal();
    if (local) dispatch({ type: "hydrate", state: local, month: monthKey() });
    setReady(true);
  }, []);

  // On authentication, sync with the server (merge rule), then enable remote saves.
  useEffect(() => {
    if (!ready) return;
    if (status !== "authenticated") {
      remoteReady.current = false;
      return;
    }
    if (remoteReady.current) return;
    let cancelled = false;
    void (async () => {
      const result = await loadRemote();
      if (cancelled || !result.ok) return;
      if (result.state) {
        // Server has state: server wins. Overwrite the local cache.
        dispatch({ type: "hydrate", state: result.state, month: monthKey() });
        saveLocal(result.state);
      } else if (hasProgress(stateRef.current)) {
        // Server empty: claim real local progress (never a pristine seed).
        await saveRemote(stateRef.current);
      }
      remoteReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [status, ready]);

  // Persist on every change once hydrated: always local; remote when synced (debounced).
  useEffect(() => {
    if (!ready) return;
    saveLocal(state);
    if (status !== "authenticated" || !remoteReady.current) return;
    const t = setTimeout(() => {
      void saveRemote(state);
    }, 800);
    return () => clearTimeout(t);
  }, [state, ready, status]);

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
    (title: string, difficulty: Difficulty, repeatable = false) => {
      if (!title.trim()) return;
      dispatch({ type: "addTask", title, difficulty, repeatable });
    },
    [],
  );

  const completeTask = useCallback(
    (task: Task) => {
      if (task.done) return;
      const meta = DIFFICULTY_META[task.difficulty];
      dispatch({ type: "completeTask", id: task.id, day: localDay() });
      pushToast(`+${meta.xp} XP  ·  +${meta.coins} coins`, "xp");
    },
    [pushToast],
  );

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: "deleteTask", id });
  }, []);

  const addReward = useCallback((name: string, cost: number) => {
    if (!name.trim()) return;
    dispatch({ type: "addReward", name, cost });
  }, []);

  const deleteReward = useCallback((id: string) => {
    dispatch({ type: "deleteReward", id });
  }, []);

  const redeem = useCallback(
    (reward: Reward): boolean => {
      if (state.coins < reward.cost) {
        pushToast(`Need ${reward.cost - state.coins} more coins`, "warn");
        return false;
      }
      dispatch({ type: "redeem", reward });
      pushToast(`Redeemed ${reward.name}`, "reward");
      return true;
    },
    [state.coins, pushToast],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    pushToast("Progress reset", "warn");
  }, [pushToast]);

  const passLevel = useMemo(() => passTierInfo(state.totalXp), [state.totalXp]);
  const accountLevel = useMemo(
    () => levelInfo(state.accountXp),
    [state.accountXp],
  );

  const value: GameContextValue = {
    state,
    passLevel,
    accountLevel,
    ready,
    toasts,
    addTask,
    completeTask,
    deleteTask,
    redeem,
    addReward,
    deleteReward,
    reset,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}

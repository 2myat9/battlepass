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
  levelInfo,
  makeId,
  type LevelInfo,
} from "./game";
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
        accountXp: state.accountXp + meta.accountXp,
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

interface GameContextValue {
  state: GameState;
  /** battle-pass tier progression (full task XP) */
  passLevel: LevelInfo;
  /** account level progression (reduced task XP) */
  accountLevel: LevelInfo;
  ready: boolean;
  toasts: Toast[];
  addTask: (title: string, difficulty: Difficulty) => void;
  completeTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  redeem: (reward: Reward) => boolean;
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
    s.tasks.length !== INITIAL_TASKS.length
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
    if (local) dispatch({ type: "hydrate", state: local });
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
        dispatch({ type: "hydrate", state: result.state });
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
      pushToast(`Redeemed ${reward.name}`, "reward");
      return true;
    },
    [state.coins, pushToast],
  );

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
    pushToast("Progress reset", "warn");
  }, [pushToast]);

  const passLevel = useMemo(() => levelInfo(state.totalXp), [state.totalXp]);
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
    reset,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}

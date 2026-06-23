# Phase 2 — Server-backed State + Local-first Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a signed-in user's `GameState` server-side and sync it across devices via a `/api/state` route and a local-first `StateRepository` seam in the store — while leaving anonymous localStorage play byte-for-byte unchanged.

**Architecture:** A new authenticated `app/api/state/route.ts` exposes `GET` (return the user's stored `GameState` or `null`) and `PUT` (validate via `sanitize()`, then upsert a single JSONB blob into `game_states`). The route derives `userId` from the server session (`auth()`), never the request body. `auth.ts` gains a `session` callback that copies `token.sub` (the DB user id the Drizzle adapter set on sign-in) into `session.user.id`, since JWT sessions don't expose it by default. `sanitize()` and the storage key are extracted from `lib/store.tsx` into a server-safe `lib/state.ts` so both the client store and the server route share one validator. A new `lib/state-repository.ts` wraps the four persistence operations (`loadLocal`/`saveLocal`/`loadRemote`/`saveRemote`). `GameProvider` hydrates from localStorage instantly on mount (unchanged), then — once `useSession()` reports `authenticated` — runs the merge rule (server-wins, claim-if-empty) and enables debounced remote saves.

**Tech Stack:** Next.js 15 (App Router, route handlers) · React 19 · TypeScript · Auth.js v5 (`next-auth@beta`, JWT sessions) · Drizzle ORM (`onConflictDoUpdate`) over `@neondatabase/serverless` · Neon (serverless Postgres).

## Global Constraints

- **Build is the only correctness gate.** No test framework is configured and CLAUDE.md designates `npm run build` (type-check + lint) as the gate. **Do not add a test framework.**
- **Keep `session: { strategy: "jwt" }`.** Adapter + JWT is the locked decision. Adding a `session` callback to expose `user.id` does **not** change the strategy.
- **Anonymous play is byte-for-byte unchanged.** Local hydration and local saves must behave exactly as today: hydrate from localStorage on mount, save synchronously on every change. Only the *remote* save is debounced and gated on auth.
- **Preserve the deterministic `initialState` hydration pattern** (CLAUDE.md SSR-mismatch gotcha). `useReducer` still initializes with the deterministic `initialState`; all loading happens in mount effects.
- **`userId` derives from the session, never the request body** (security). The route reads `session.user.id`; `sanitize()` returns only the `GameState` shape, so any client-supplied id field is discarded.
- **`game_states.userId` references `users.id` with `onDelete: cascade`** — already established in Phase 1; this phase only reads/writes the row.
- **Secrets never committed.** `DATABASE_URL` and auth secrets stay in `.env.local`. No new env vars are introduced in this phase.
- **`@/*` path alias** maps to the repo root (`tsconfig.json`).

---

## Prerequisites

This phase builds **on top of the Phase 1 branch**, which is not yet merged to `main`. The current branch is `phase-1-postgres-database` (Drizzle schema, client, migration, and `DrizzleAdapter` wiring all present and applied to Neon). `DATABASE_URL` is already in `.env.local` and the five tables (including the empty `game_states`) already exist in Neon. **No owner-only pause is required this time** — everything here is doable by the agent.

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/state.ts` | Create | Server-safe shared module: `STORAGE_KEY` + `sanitize()` (moved verbatim from the store). The single validator used by both client and server. |
| `lib/store.tsx` | Modify | Import `STORAGE_KEY`/`sanitize` from `./state` (Task 1); later switch persistence to the repository and add session-driven sync (Task 3). |
| `auth.ts` | Modify | Add a `session` callback exposing `session.user.id = token.sub`. |
| `app/api/state/route.ts` | Create | Authenticated `GET`/`PUT` for the user's `GameState` blob. |
| `lib/state-repository.ts` | Create | `loadLocal`/`saveLocal`/`loadRemote`/`saveRemote` — the persistence seam. |

---

## Task 1: Branch and extract the shared `sanitize` validator

Pure refactor — no behavior change. Extracts `STORAGE_KEY` and `sanitize()` out of the `"use client"` store into a server-safe module so the API route (Task 2) can share the exact same validator.

**Files:**
- Create: `lib/state.ts`
- Modify: `lib/store.tsx`

**Interfaces:**
- Produces: `STORAGE_KEY: string` and `sanitize(raw: unknown): GameState | null`, importable from `@/lib/state` by both client and server code.

- [ ] **Step 1: Create the Phase 2 branch off the Phase 1 branch**

The repo is on `phase-1-postgres-database`. Phase 2 depends on it, so branch from it (not `main`):
```bash
git switch -c phase-2-server-state-sync
```
Expected: `Switched to a new branch 'phase-2-server-state-sync'`.

- [ ] **Step 2: Create `lib/state.ts`**

Create `lib/state.ts`. It has no `"use client"` directive and imports only types, so it is safe to import from a server route. The body of `sanitize` is copied verbatim from `lib/store.tsx`:

```ts
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
```

- [ ] **Step 3: Remove the duplicated definitions from `lib/store.tsx` and import them**

In `lib/store.tsx`, delete the local `const STORAGE_KEY = "battlepass.state.v1";` line (currently line 22) and the entire `function sanitize(raw: unknown): GameState | null { ... }` block (currently lines 104–120).

Then add an import of both from `./state`. Place it immediately after the existing `./game` import block, before the `./types` import:

```ts
import { STORAGE_KEY, sanitize } from "./state";
```

`initialState` stays defined in `lib/store.tsx` (it is coupled to the reducer's `reset` case and the `useReducer` initializer; the route does not need it). The mount and persist effects still reference `STORAGE_KEY`/`sanitize` exactly as before — they now resolve to the imported versions. No behavior changes.

- [ ] **Step 4: Verify the build**

```bash
npm run build
```
Expected: build succeeds with no type or lint errors. This is a pure extraction; the app behaves identically.

- [ ] **Step 5: Commit**

```bash
git add lib/state.ts lib/store.tsx
git commit -m "refactor(state): extract sanitize and storage key into shared module"
```

---

## Task 2: Add the `/api/state` route and expose `session.user.id`

The route is useless without a server-derivable user id, so the `auth.ts` callback ships in the same task.

**Files:**
- Modify: `auth.ts`
- Create: `app/api/state/route.ts`

**Interfaces:**
- Consumes: `auth` from `@/auth`; `db` from `@/lib/db`; `gameStates` from `@/lib/db/schema`; `sanitize` from `@/lib/state` (Task 1).
- Produces: `GET /api/state` → `200 GameState | null` or `401`; `PUT /api/state` → `200 { ok: true }`, `400` (invalid body), or `401`.

- [ ] **Step 1: Expose the DB user id on the session in `auth.ts`**

The current `auth.ts` is:
```ts
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  session: { strategy: "jwt" },
});
```

Replace it with (adds only the `callbacks` block):
```ts
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
```

Why: with JWT sessions, Auth.js sets `token.sub` to the user id on sign-in. Because the Drizzle adapter is configured, that id is the **database** `user.id` (the FK target for `game_states.user_id`). The default session object does not surface it, so this callback copies it onto `session.user.id`. `session.user.id` is typed `string | undefined` by next-auth v5, so no module augmentation is needed.

- [ ] **Step 2: Create `app/api/state/route.ts`**

```ts
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { gameStates } from "@/lib/db/schema";
import { sanitize } from "@/lib/state";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(null, { status: 401 });

  const rows = await db
    .select({ data: gameStates.data })
    .from(gameStates)
    .where(eq(gameStates.userId, userId))
    .limit(1);

  return Response.json(rows[0]?.data ?? null);
}

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response(null, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const clean = sanitize(body);
  if (!clean) return new Response(null, { status: 400 });

  await db
    .insert(gameStates)
    .values({ userId, data: clean })
    .onConflictDoUpdate({
      target: gameStates.userId,
      set: { data: clean, updatedAt: new Date() },
    });

  return Response.json({ ok: true });
}
```

Notes:
- `gameStates.data` is typed `$type<GameState>()`, so `rows[0]?.data` is `GameState | undefined` and `?? null` yields the `GameState | null` the contract promises.
- `userId` comes only from the session. `sanitize()` strips the body to the `GameState` shape, so a malicious `userId` field in the payload is ignored.
- The upsert sets `updatedAt: new Date()` on conflict (insert uses the column's `defaultNow()`).

- [ ] **Step 3: Verify the build**

```bash
npm run build
```
Expected: build succeeds. `DATABASE_URL` is already in `.env.local` (Phase 1), and the route imports `db` exactly as `auth.ts` already does — the build constructs the Neon client but runs no queries.

- [ ] **Step 4: Verify unauthenticated access is rejected**

Start the dev server in one shell:
```bash
npm run dev
```
In another shell, hit the route with no session cookie:
```bash
curl -s -o /dev/null -w "GET %{http_code}\n" http://localhost:3000/api/state
curl -s -o /dev/null -w "PUT %{http_code}\n" -X PUT -H "Content-Type: application/json" -d '{}' http://localhost:3000/api/state
```
Expected: `GET 401` and `PUT 401`. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add auth.ts app/api/state/route.ts
git commit -m "feat(api): add authenticated /api/state GET and PUT"
```

---

## Task 3: Add the repository seam and wire local-first sync into the store

**Files:**
- Create: `lib/state-repository.ts`
- Modify: `lib/store.tsx`

**Interfaces:**
- Consumes: `STORAGE_KEY`/`sanitize` from `@/lib/state` (Task 1); the `/api/state` route (Task 2).
- Produces (from `lib/state-repository.ts`):
  - `type RemoteLoad = { ok: true; state: GameState | null } | { ok: false }`
  - `loadLocal(): GameState | null`
  - `saveLocal(state: GameState): void`
  - `loadRemote(): Promise<RemoteLoad>`
  - `saveRemote(state: GameState): Promise<boolean>`

- [ ] **Step 1: Create `lib/state-repository.ts`**

```ts
import { sanitize, STORAGE_KEY } from "./state";
import type { GameState } from "./types";

export type RemoteLoad =
  | { ok: true; state: GameState | null }
  | { ok: false };

export function loadLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable */
  }
}

export async function loadRemote(): Promise<RemoteLoad> {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, state: data == null ? null : sanitize(data) };
  } catch {
    return { ok: false };
  }
}

export async function saveRemote(state: GameState): Promise<boolean> {
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

The `RemoteLoad` discriminator distinguishes "reached the server, it has state" / "reached the server, it is empty" (both `ok: true`) from "401 or network error" (`ok: false`) — so the merge rule never mistakes an unreachable server for "empty, claim local."

- [ ] **Step 2: Update imports in `lib/store.tsx`**

The store no longer references `STORAGE_KEY`/`sanitize` directly (the repository owns them now) but does need `useSession` and the repository functions. Replace the `./state` import added in Task 1 and the `./game` import region so the import block reads:

```ts
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
```

(`initialState`, the `reducer`, the `Action` type, and everything below the provider are unchanged.)

- [ ] **Step 3: Replace the mount/persist effects with sync-aware effects**

In `GameProvider`, the current code declares the refs/state then has two effects: the mount-load effect (currently lines 142–154) and the persist effect (currently lines 156–164). Replace the ref/state declarations region and those two effects.

Find:
```ts
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
```

Replace with:
```ts
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
      } else {
        // Server empty: claim the current local progress.
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
```

How it satisfies the spec:
- **Anonymous:** `status` is never `authenticated`, so `remoteReady` stays `false`; the persist effect calls `saveLocal(state)` synchronously on every change and returns — identical to today. Mount still hydrates from localStorage instantly.
- **First sign-in, server empty:** `loadRemote()` returns `{ ok: true, state: null }` → `saveRemote(stateRef.current)` claims the current local progress.
- **Sign-in, server has state:** `{ ok: true, state }` → `hydrate` from remote and overwrite local (server wins).
- **Unreachable server / 401:** `{ ok: false }` → no-op; stays local-only.
- **Sign-out:** `status` flips away from `authenticated` → `remoteReady` reset to `false`; saves go local-only again.

- [ ] **Step 4: Verify the build**

```bash
npm run build
```
Expected: build succeeds with no type or lint errors. (`stateRef`/`remoteReady` are refs and `dispatch`/the imported repository functions are stable, so `react-hooks/exhaustive-deps` does not flag the `[status, ready]` / `[state, ready, status]` dependency arrays.)

- [ ] **Step 5: Commit**

```bash
git add lib/state-repository.ts lib/store.tsx
git commit -m "feat(store): local-first server sync via state repository"
```

---

## Task 4: End-to-end verification

Exercises the full Phase 2 acceptance checklist from the spec. No code changes — if a check fails, return to the relevant task.

**Files:** none.

- [ ] **Step 1: Anonymous play is unchanged**

```bash
npm run dev
```
In a normal (signed-out) window at http://localhost:3000: add a task and complete it. Confirm XP/coins/toast behave as before, then reload — progress is restored from localStorage. Leave this anonymous progress in place for the next step.

- [ ] **Step 2: First sign-in claims local progress (server was empty)**

Because a stale Phase 0/1 JWT cookie can make you appear signed in without re-running OAuth, **sign out first if the button reads "Sign out," then sign in** with Google. After returning signed in, check Neon (SQL Editor or `npm run db:studio`):
```sql
SELECT user_id, data->>'totalXp' AS total_xp,
       jsonb_array_length(data->'tasks') AS task_count
FROM game_states;
```
Expected: exactly one `game_states` row whose `total_xp` / `task_count` match the anonymous progress you just made — it was claimed into your account.

- [ ] **Step 3: Cross-device sync (server wins on a fresh client)**

Open a **separate browser or a private window** at http://localhost:3000 and sign in with the same Google account. Expected: the signed-in state (same tasks/XP/coins) appears, loaded from the server — even though that browser's localStorage started empty.

- [ ] **Step 4: Edits propagate to the server (debounced save)**

In a signed-in window, complete another task. Wait ~2 seconds (past the 800 ms debounce), then re-run the query from Step 2. Expected: `total_xp` / `task_count` reflect the new change.

- [ ] **Step 5: Invalid PUT is rejected (authenticated)**

In a signed-in window's browser devtools console (the session cookie is sent automatically):
```js
await fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tasks: "not-an-array" }),
}).then((r) => r.status);
```
Expected: `400` (sanitize rejects it). Then confirm a valid payload still works:
```js
await fetch("/api/state", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tasks: [], totalXp: 0, coins: 0, tasksCompleted: 0,
    completedByDifficulty: { easy: 0, medium: 0, hard: 0 }, purchases: {} }),
}).then((r) => r.status);
```
Expected: `200`.

- [ ] **Step 6: Sign-out returns to anonymous local play**

Sign out. Add and complete a task. Expected: it works and persists via localStorage on reload (no network calls to `/api/state` for saves). Stop the dev server.

- [ ] **Step 7: Final build gate**

```bash
npm run build
```
Expected: clean build. Phase 2 is complete.

---

## Self-review notes (against the spec)

- **Spec Phase 2 bullets — coverage:** `app/api/state/route.ts` `GET` (401 if unauth, else stored data or `null`) and `PUT` (`sanitize` → 400 if invalid, else upsert) — Task 2. Refactor persistence behind a `StateRepository` with `loadLocal`/`saveLocal`/`loadRemote`/`saveRemote` — Task 3. Mount hydrates from localStorage first and sets `ready`; on `authenticated`, `loadRemote` + merge rule + enable remote saves; saves always local and remote-when-authed (debounced); anonymous unchanged — Task 3. All covered.
- **Spec API contract:** `GET /api/state` → `200 GameState | null` / `401`; `PUT /api/state` → `200 { ok: true }` / `400` / `401`. Matches Task 2 exactly.
- **Spec merge rule:** server empty → push local up (`saveRemote(stateRef.current)`); server has state → server wins (`hydrate` + overwrite local). Implemented in the Task 3 session effect; the `RemoteLoad` discriminator prevents treating an unreachable server as "empty."
- **Spec data model / storage shape:** single JSONB blob upserted into `game_states` keyed by `user_id`; `data` typed `GameState`; `updatedAt` bumped on update. Task 2.
- **Spec security ("derive `userId` from `auth()`, never the body"):** the route reads `session.user.id`; `sanitize()` discards any body-supplied id. The `session` callback (Task 2) makes `session.user.id` the real DB id. Task 2.
- **Spec error handling:** remote save failure → `saveRemote` returns `false`, localStorage remains source of truth, UI never blocked (Task 3); invalid remote payload → `sanitize` returns `null`, `loadRemote` yields `state: null` and the client falls back to local; unauthenticated hit → `401` treated as local-only (`{ ok: false }`).
- **Spec SSR note:** `useReducer` still seeds with the deterministic `initialState`; loading happens only in mount/session effects. Preserved.
- **Out of scope (correctly absent):** server-side querying/normalization, additional providers, per-field conflict merge, live multi-device sync. None added.
- **Type/name consistency:** `RemoteLoad`, `loadLocal`, `saveLocal`, `loadRemote`, `saveRemote` are defined in `lib/state-repository.ts` and consumed under those exact names in `lib/store.tsx`; `sanitize`/`STORAGE_KEY` are defined in `lib/state.ts` and consumed by both the repository and the route; `gameStates`/`gameStates.data`/`gameStates.userId` match the Phase 1 schema; `session.user.id` is produced by the `auth.ts` callback and consumed by the route.
- **Build-vs-runtime ordering:** every task ends green on `npm run build`; `DATABASE_URL` already exists from Phase 1, so no owner pause is needed.

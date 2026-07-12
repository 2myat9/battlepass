# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build (also runs type-checking + lint)
npm run start    # serve the production build
npm run lint     # next lint
```

There is no test framework configured. `npm run build` is the primary correctness gate — it type-checks the whole project and fails on type or lint errors.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 (via `@tailwindcss/postcss`). The `@/*` path alias maps to the repo root.

## Architecture

This is a **single-page** gamified todo app ("Battlepass"). Despite being a Next.js app, there is only one route (`/`). The three "tabs" (Tasks / Rewards / Stats) are **not routes** — they are swapped by local React state (`tab`) in the `Shell` component inside `app/page.tsx`. Adding a tab means adding to that switch and to `components/TabBar.tsx`, not creating a new page.

There is intentionally **no backend**; all state lives on the client. The seam for a future backend is `lib/store.tsx` (the reducer actions and `sanitize()`).

### State: `lib/store.tsx` is the single source of truth

`GameProvider` holds the entire `GameState` in a `useReducer`. Every component reads and mutates state only through the `useGame()` hook — never via local copies. All state transitions go through the reducer's pure action handlers (`addTask`, `completeTask`, `deleteTask`, `redeem`, `reset`, `hydrate`).

Persistence and hydration follow a specific, deliberate pattern — preserve it to avoid SSR hydration mismatches:

- Initial render uses the deterministic `initialState` on **both** server and client.
- A mount `useEffect` loads from `localStorage` (key `battlepass.state.v1`) and dispatches `hydrate`.
- A `ready` flag gates the persistence effect so it doesn't overwrite storage before hydration has run.
- `sanitize()` validates/normalizes any persisted blob before it is trusted — this is the validation boundary.

Toasts are part of the store (`pushToast` is fired from `completeTask`/`redeem`), not a separate system, and are rendered by `components/Toasts.tsx`.

### Game rules: `lib/game.ts` is the tuning file

All gameplay numbers and derived math live here — change this file to rebalance the game:

- `DIFFICULTY_META` — XP/coin rewards per difficulty (exponential: easy/medium/hard). Each task pays **two XP pools**: full `xp` into the battle pass (`GameState.totalXp`, drives the Stats tier track) and a reduced `accountXp` into the account level (`GameState.accountXp`, drives the TopBar level stamp) so the account level stays uninflated.
- The two progressions use **different curves**. `xpForLevel` / `levelInfo` — exponential curve (`100 * 1.32^(level-1)`) — is the lifetime **account level** (`accountLevel` in the store). `passTierInfo` — flat `PASS_TIER_XP` (280) per tier, capped at `PASS_TIERS` (15) — is the **battle pass** (`passLevel`), paced so the target daily mix (2 easy + 1 medium + 1 hard = 140 pass XP) finishes it in ~28 days.
- The battle pass is a **monthly season**: `rollSeason` in `lib/store.tsx` resets `totalXp` (never `accountXp`) on the first `hydrate`/`completeTask` in a new month, keyed by `GameState.passSeason` (`"YYYY-MM"`, `""` = adopt current month without resetting). Crossing the final tier increments `passesCompleted` immediately. Calendar helpers (local-date strings, days-left math) live in `lib/season.ts`; the daily streak (`streakCount` / `streakLastDay`) also updates in `completeTask`. `sanitize()` back-fills all of these plus `accountXp` for old saves.
- `buildTrack` — the Stats tab's battle-pass tier list (always `PASS_TIERS` long).
- `REWARDS` and `INITIAL_TASKS` are **seed data only**: both are copied into state (`GameState.rewards` / `.tasks`) and the user edits their own copies (`addReward`/`deleteReward` actions; the shop renders `state.rewards` sorted by cost, not the constant).

### Styling: `app/globals.css`

Visual styling is plain CSS classes (`.task`, `.tier`, `.meter`, …) driven by theme tokens defined as CSS custom properties in `:root`. Tailwind v4 is imported but used sparingly. Per-difficulty accent colors are passed to components via inline CSS variables (`--task-accent`, `--seg-accent`) that reference `--easy` / `--medium` / `--hard`.

The design system is deliberately **flat**: white paper / navy ink (`--ink`) with a single cobalt accent (`--live`), IBM Plex Sans + Mono (loaded via `next/font` in `app/layout.tsx`), and **no border-radius, box-shadow, gradients, or emoji anywhere**. Difficulty is encoded as depth-of-blue plus tally glyphs (`▮`/`▮▮`/`▮▮▮` in `DIFFICULTY_META`); progress is rendered as discrete square cells by `components/Meter.tsx` — reuse it for any new progress display rather than adding a continuous bar.

**Gotcha:** do not give a CSS class a name that collides with a Tailwind v4 utility (e.g. a class literally named `ring` pulls in Tailwind's `ring` box-shadow utility and draws a rectangular outline).

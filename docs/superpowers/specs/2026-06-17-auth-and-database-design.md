# Auth + Database for Battlepass — Design

- **Date:** 2026-06-17
- **Status:** Approved (design); pending implementation plan
- **Author:** Brainstormed with Claude Code

## Context

Battlepass is currently a fully client-side, single-route Next.js 15 app. The
entire `GameState` (tasks, XP, coins, stats, purchases) lives in a `useReducer`
inside `GameProvider` (`lib/store.tsx`) and is persisted to `localStorage` under
the key `battlepass.state.v1`. There is intentionally **no backend**.
`lib/store.tsx` is explicitly the seam for a future backend, and `sanitize()` is
the validation boundary for any persisted blob.

We want to add (1) user accounts via OAuth sign-in and (2) a database — without
losing the instant, no-login play that exists today.

## Goals

- Let users sign in with Google.
- Persist a signed-in user's game state server-side and sync it across devices.
- Preserve the current experience for anonymous users (instant play, no login).
- Keep each increment independently shippable.

## Non-goals (v1)

- Server-side querying of game data (leaderboards, social, analytics). The state
  is stored as an opaque JSONB blob; normalization is deferred.
- Multiple OAuth providers (Google only for now).
- Email/password or magic-link sign-in.
- Field-by-field conflict merging across devices (see Merge Rule).
- Real-time multi-tab/multi-device live sync (sync happens on load + debounced save).

## Locked decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stack | Auth.js v5 (NextAuth) + Postgres | Stays in the Next.js ecosystem, no extra vendor; auth ships before the DB exists. |
| Account model | Optional, local-first | Anonymous play unchanged; sign-in is an additive upgrade that syncs progress. |
| Provider | Google only | Broad reach; keeps JWT sessions so Phase 0 needs no DB. |
| ORM | Drizzle | TypeScript-native, no codegen/engine binary, first-party Auth.js adapter. |
| Postgres host | Neon | Serverless, generous free tier; what Vercel Postgres uses under the hood. |
| Deploy target | Vercel | Natural home for Next.js. |
| Storage shape | Single JSONB blob | Matches the current single-blob model and `sanitize()`; minimal code. |
| Merge on sign-in | Server wins (claim-if-empty) | Predictable; avoids fiddly per-field merge. See Merge Rule. |

## Architecture

Three concerns are layered onto the existing client app, in order. The browser
store (`lib/store.tsx`) remains the single source of truth at runtime; we only
change *where* it persists.

```
┌─────────────────────── Browser ───────────────────────┐
│  GameProvider (useReducer)  ──►  StateRepository       │
│      ▲  reads/writes                │                  │
│      │                    ┌─────────┴─────────┐        │
│  components (useGame)     │ local (localStorage)│       │
│                           │ remote (fetch /api) │ ◄─ when authed
└───────────────────────────┼─────────────────────┼──────┘
                            │                     │
                  ┌─────────▼─────────┐  ┌────────▼─────────┐
                  │ Auth.js (Google)  │  │ /api/state route │
                  │  JWT session      │  │  GET / PUT       │
                  └─────────┬─────────┘  └────────┬─────────┘
                            │                     │
                            └────────┬────────────┘
                                     ▼
                            Neon Postgres (Drizzle)
                   users · accounts · sessions · game_states
```

## Phased plan

### Phase 0 — Auth, zero database (ships standalone)

- Add `next-auth@beta` (Auth.js v5).
- `auth.ts` (repo root) exports `{ handlers, auth, signIn, signOut }` from
  `NextAuth({ providers: [Google], session: { strategy: "jwt" } })`.
- `app/api/auth/[...nextauth]/route.ts` re-exports `handlers` as `GET`/`POST`.
- A client `SessionProvider` wrapper (`components/Providers.tsx`) added to
  `app/layout.tsx`.
- A Sign in / Sign out control in `components/TopBar.tsx` using
  `useSession`/`signIn`/`signOut`.
- Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

**Outcome:** working "Sign in with Google" and a real session in the app. Game
state still in `localStorage`. No database required. This is the only piece that
delivers standalone value, which is why auth comes first.

### Phase 1 — Database + Auth.js adapter

- Provision a Neon project; add `DATABASE_URL`.
- Add `drizzle-orm`, `drizzle-kit`, `@auth/drizzle-adapter`,
  `@neondatabase/serverless`.
- `lib/db/schema.ts`: the four Auth.js tables (`users`, `accounts`, `sessions`,
  `verificationTokens`) per the Drizzle adapter's recommended schema, plus
  `game_states`.
- `lib/db/index.ts`: Drizzle client over the Neon serverless driver.
- `drizzle.config.ts` for `drizzle-kit`.
- Wire `DrizzleAdapter(db)` into `auth.ts`. Keep `session.strategy = "jwt"`; the
  adapter still persists `users`/`accounts` rows on sign-in.
- Generate + run the first migration.

**Outcome:** signing in creates a durable user row. No gameplay change yet.

### Phase 2 — Server-backed state + local-first sync

- `app/api/state/route.ts`:
  - `GET` → `auth()`; if unauthenticated return 401; else return the user's
    `game_states.data` or `null`.
  - `PUT` → `auth()`; validate the body through `sanitize()`; reject invalid with
    400; upsert (`insert ... on conflict (user_id) do update`).
- Refactor the persistence layer in `lib/store.tsx` behind a small
  `StateRepository` seam:
  - `loadLocal()` / `saveLocal()` — the existing localStorage logic.
  - `loadRemote()` / `saveRemote()` — `fetch` the API.
  - Mount: hydrate from `localStorage` first (instant; unchanged), set `ready`.
  - When `useSession()` becomes `authenticated`: `loadRemote()`, apply the Merge
    Rule, then enable remote saves.
  - Saves: debounced; always `saveLocal`, and `saveRemote` when authenticated.
  - Anonymous users: behavior is byte-for-byte unchanged.

**Outcome:** cross-device sync for signed-in users; anonymous play untouched.

## Data model

```ts
// lib/db/schema.ts (game_states; Auth.js tables omitted for brevity)
export const gameStates = pgTable("game_states", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<GameState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

`data` holds the same `GameState` shape the store already uses. `sanitize()` is
the single validator for it on the way in (PUT) and on the way out (after GET).

## API contract

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `GET` | `/api/state` | required | — | `200 GameState \| null`, `401` |
| `PUT` | `/api/state` | required | `GameState` | `200 { ok: true }`, `400` invalid, `401` |

Auth endpoints are handled entirely by Auth.js at `/api/auth/*`.

## Merge rule (first sign-in)

On the first authenticated `loadRemote()` after sign-in:

- **Server empty** → push the current local state up (`saveRemote`). The user
  "claims" their anonymous progress into the account.
- **Server has state** → server wins. `hydrate` the store from remote and
  overwrite the local cache.

Sacrificed edge case (accepted for v1): anonymous progress made on a *second*
device, after a cloud save already exists, is discarded on sign-in.

## Environment variables

```
AUTH_SECRET=          # openssl rand -base64 33
AUTH_GOOGLE_ID=       # Google Cloud OAuth client id
AUTH_GOOGLE_SECRET=   # Google Cloud OAuth client secret
DATABASE_URL=         # Neon connection string (Phase 1+)
```

An `.env.example` documents these. Google credentials are created by the project
owner in Google Cloud Console (authorized redirect URI:
`https://<domain>/api/auth/callback/google` and the localhost equivalent).

## Error handling

- **Remote save fails (network/5xx):** localStorage remains the source of truth;
  retry with backoff. Never block the UI; surface at most a quiet toast.
- **Remote payload invalid:** `sanitize()` returns `null` → fall back to local.
- **Unauthenticated API hit:** `401`; client treats it as "anonymous, local only."
- **Auth errors:** handled by Auth.js's standard error routing.

## Security considerations

- The `/api/state` handlers must derive `userId` from the server session
  (`auth()`), never from the request body — prevents writing to another user's row.
- `game_states.userId` references `users.id` with `onDelete: cascade`.
- Secrets stay in env / Vercel project settings, never committed.

## Testing / verification

No test framework is configured; `npm run build` (type-check + lint) is the
correctness gate. Per-phase manual checklist:

- **Phase 0:** sign in with Google → session visible; sign out clears it; build passes.
- **Phase 1:** sign in → a `users` row is created in Neon; build passes.
- **Phase 2:** complete tasks anonymously → sign in → progress appears server-side;
  reload / second browser → state syncs; sign out → anonymous local play still works;
  invalid PUT is rejected.

## Risks / notes

- App is `"use client"`; `SessionProvider` is fine. Preserve the deterministic
  `initialState` hydration pattern to avoid the SSR mismatch CLAUDE.md warns about.
- Google OAuth credential creation is a manual, owner-only step.
- Adapter + JWT strategy is a supported combination; revisit only if we later want
  server-side session revocation.

## Future work (out of scope)

- Normalize `tasks`/stats into real tables to enable leaderboards and analytics.
- Additional providers (GitHub, email).
- Live multi-device sync / conflict resolution beyond "server wins."

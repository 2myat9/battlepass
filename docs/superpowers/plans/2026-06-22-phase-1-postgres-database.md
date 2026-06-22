# Phase 1 — Serverless Postgres (Neon + Drizzle + Auth.js adapter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a serverless Postgres database (Neon) with a Drizzle schema and wire the Auth.js Drizzle adapter into the existing Google sign-in, so signing in writes a durable `user`/`account` row — with no gameplay change and anonymous local play untouched.

**Architecture:** A Drizzle schema (`lib/db/schema.ts`) defines the four Auth.js tables (`user`, `account`, `session`, `verificationToken`) per the adapter's recommended Postgres shape, plus a `game_states` table (a single JSONB blob keyed by `user_id`, created now but unused until Phase 2). A Drizzle client (`lib/db/index.ts`) runs over the `@neondatabase/serverless` HTTP driver. `drizzle-kit` generates and applies the first migration. `auth.ts` gains `adapter: DrizzleAdapter(db)` while keeping `session: { strategy: "jwt" }` — the adapter still persists user/account rows on sign-in even with JWT sessions. The `GameProvider` store and localStorage persistence are left completely untouched in this phase.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Auth.js v5 (`next-auth@beta`) · `@auth/drizzle-adapter` · `drizzle-orm` + `drizzle-kit` · `@neondatabase/serverless` · Neon (serverless Postgres).

## Global Constraints

- **Build is the only correctness gate.** No test framework is configured and CLAUDE.md designates `npm run build` (type-check + lint) as the gate. **Do not add a test framework.**
- **Keep `session: { strategy: "jwt" }`.** The adapter + JWT strategy is the locked decision; do not switch to database sessions.
- **Do not touch `lib/store.tsx` or any gameplay code.** Server-backed state + sync is Phase 2. Phase 1 must produce zero gameplay change and leave anonymous localStorage play byte-for-byte unchanged.
- **Preserve the deterministic `initialState` hydration pattern** (CLAUDE.md SSR-mismatch gotcha). Phase 1 changes no store code, so this holds by construction.
- **Secrets never committed.** `.gitignore` already ignores `.env*` except `.env.example`. `DATABASE_URL` goes only in `.env.local` (and later Vercel project settings).
- **`@/*` path alias** maps to the repo root (`tsconfig.json`).
- **`userId` derives from the session, never the request body** (security note; the FK + cascade established here enforces ownership at the DB layer).

---

## Prerequisites for the human owner

One step requires the project owner and cannot be done by an agent: **provisioning the Neon database and supplying `DATABASE_URL`.** It is written out fully in **Task 4**.

An agent executing this plan can complete **Tasks 1–3 entirely offline** (install deps, write the schema/client/config, and generate the migration SQL — `drizzle-kit generate` diffs schema files and never connects to a database). The agent must then **pause at Task 4** and ask the owner to create the Neon project and add `DATABASE_URL` to `.env.local`, because:

- Task 5's `npm run build` evaluates the auth route, which (once the adapter is wired) constructs the Neon client and requires `DATABASE_URL` to be a valid connection string.
- Task 6 applies the migration to the live database and verifies the sign-in round-trip.

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `.env.example` | Modify | Document the new `DATABASE_URL` var (no secret value). |
| `.env.local` | Modify (owner, not committed) | Real Neon connection string. |
| `package.json` | Modify (via `npm install`) + edit | Add deps; add `db:generate` / `db:migrate` / `db:studio` scripts. |
| `lib/db/schema.ts` | Create | Drizzle schema: `user`, `account`, `session`, `verificationToken`, `game_states`. |
| `lib/db/index.ts` | Create | Drizzle client over the Neon serverless HTTP driver. |
| `drizzle.config.ts` | Create | `drizzle-kit` config (schema path, migrations out dir, dialect, credentials). |
| `lib/db/migrations/*` | Create (generated) | First migration SQL + snapshot, committed for review. |
| `auth.ts` | Modify | Add `adapter: DrizzleAdapter(db)`; keep JWT strategy. |

---

## Task 1: Create the feature branch and install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

- [ ] **Step 1: Branch off `main`**

The repo is on `main`. Create a Phase 1 branch so work stays isolated (mirrors Phase 0's `phase-0-google-oauth`):
```bash
git switch -c phase-1-postgres-database
```
Expected: `Switched to a new branch 'phase-1-postgres-database'`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless @auth/drizzle-adapter
```
Expected: all three appear under `dependencies` in `package.json`. If npm errors on React 19 peer ranges, re-run with `--legacy-peer-deps` (same workaround Phase 0 used for `next-auth@beta`).

- [ ] **Step 3: Install dev dependencies**

`drizzle-kit` is the migration CLI; `dotenv` lets the CLI read `DATABASE_URL` from `.env.local` (Next.js loads `.env.local` for the app, but the standalone `drizzle-kit` CLI does not):
```bash
npm install -D drizzle-kit dotenv
```
Expected: both appear under `devDependencies`.

- [ ] **Step 4: Confirm install is clean**

```bash
npm run build
```
Expected: build succeeds. No source has changed yet — this only confirms the new packages didn't break resolution.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(db): add drizzle, neon serverless, and auth drizzle adapter"
```

---

## Task 2: Document `DATABASE_URL` and write the Drizzle schema

**Files:**
- Modify: `.env.example`
- Create: `lib/db/schema.ts`

- [ ] **Step 1: Add `DATABASE_URL` to `.env.example`**

Append to `.env.example` (after the Google block) so the required var is documented without a value:
```dotenv

# Neon serverless Postgres connection string (Phase 1+).
# Neon Console -> your project -> Connection Details -> copy the
# "Pooled connection" string (postgresql://...neon.tech/<db>?sslmode=require).
DATABASE_URL=
```

- [ ] **Step 2: Create `lib/db/schema.ts`**

Create `lib/db/schema.ts`. The first four tables follow the Auth.js Drizzle adapter's recommended Postgres schema (table names `user`/`account`/`session`/`verificationToken` are the adapter defaults). `gameStates` adds the single-blob store keyed by `user_id`, typed to the app's existing `GameState`:

```ts
import {
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { GameState } from "@/lib/types";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

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

Notes:
- The `(account) => [ ... ]` / `(vt) => [ ... ]` array form is the current drizzle-orm constraint-callback style (the older object-returning form is deprecated).
- `session` and `verificationToken` are part of the adapter's standard schema; with JWT sessions they stay empty, but keeping them matches the adapter and lets us switch strategies later without a migration.
- `crypto.randomUUID()` is a Node 20 / Web Crypto global — no import needed.

- [ ] **Step 3: Type-check**

```bash
npm run build
```
Expected: build succeeds with no type or lint errors. `schema.ts` is type-checked but not yet imported by any route, so no database connection is attempted.

- [ ] **Step 4: Commit**

```bash
git add .env.example lib/db/schema.ts
git commit -m "feat(db): add drizzle schema for auth tables and game_states"
```

---

## Task 3: Create the Drizzle client, config, and first migration

**Files:**
- Create: `lib/db/index.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json` (scripts)
- Create: `lib/db/migrations/*` (generated)

- [ ] **Step 1: Create the Drizzle client**

Create `lib/db/index.ts`. It builds the HTTP client from `DATABASE_URL` and binds the schema so queries are typed:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
```

Note: `neon()` only validates the connection-string format and never opens a connection until a query runs, so importing this module is cheap. It is **not** imported by any route until Task 5, so the build stays green before `DATABASE_URL` exists.

- [ ] **Step 2: Create `drizzle.config.ts`**

Create `drizzle.config.ts` in the repo root. `dotenv` loads `.env.local` so the CLI sees `DATABASE_URL`:

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 3: Add database scripts to `package.json`**

In the `"scripts"` block of `package.json`, add the three Drizzle commands alongside the existing scripts:

```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
```

(Place them after `"lint": "next lint"`, adding the needed trailing comma on the `lint` line.)

- [ ] **Step 4: Generate the first migration (offline)**

```bash
npm run db:generate
```
Expected: drizzle-kit reads `lib/db/schema.ts` and writes `lib/db/migrations/0000_*.sql` (containing `CREATE TABLE "user"`, `"account"`, `"session"`, `"verificationToken"`, `"game_states"` with the foreign keys) plus a `meta/` snapshot and `meta/_journal.json`. This command does **not** connect to a database. If drizzle-kit prompts, accept the generated SQL.

- [ ] **Step 5: Sanity-check the generated SQL**

```bash
ls lib/db/migrations && grep -l "CREATE TABLE" lib/db/migrations/*.sql
```
Expected: a `0000_*.sql` file is listed and matches. Open it and confirm all five tables and the `user_id`/`userId` foreign keys with `ON DELETE cascade` are present.

- [ ] **Step 6: Verify the build still passes**

```bash
npm run build
```
Expected: build succeeds. `lib/db/index.ts` type-checks but is still unreferenced by any route, so no connection is attempted and `DATABASE_URL` is not required yet.

- [ ] **Step 7: Commit**

```bash
git add lib/db/index.ts drizzle.config.ts package.json lib/db/migrations
git commit -m "feat(db): add drizzle client, config, and initial migration"
```

---

## Task 4: Provision Neon and supply `DATABASE_URL` (owner-only)

**Owner-only manual setup.** An agent executing this plan should **stop here** and hand the task to the project owner. Tasks 5–6 cannot pass until `DATABASE_URL` points at a real Neon database.

**Files:**
- Modify: `.env.local` (owner; not committed)

- [ ] **Step 1 (owner): Create a Neon project**

At [console.neon.tech](https://console.neon.tech/): sign in → **New Project** → pick a name (e.g. `battlepass`) and the default Postgres version/region → **Create**.

- [ ] **Step 2 (owner): Copy the connection string**

In the project dashboard → **Connection Details** → copy the **Pooled connection** string. It looks like:
```
postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```

- [ ] **Step 3 (owner): Add it to `.env.local`**

Append to the existing `.env.local` (which already holds the Phase 0 auth secrets):
```dotenv
DATABASE_URL=postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
```

- [ ] **Step 4 (owner): Confirm it stays out of git**

```bash
git status --short
```
Expected: `.env.local` does **not** appear (it is covered by the `.env*` rule). If it does, stop and fix `.gitignore` before continuing — the connection string contains the database password.

---

## Task 5: Wire the Drizzle adapter into Auth.js

**Files:**
- Modify: `auth.ts`

**Interfaces:**
- Consumes: `db` (default export-style named export from `@/lib/db`).
- Produces: an `auth.ts` whose `NextAuth` config carries `adapter: DrizzleAdapter(db)` while keeping `session.strategy = "jwt"`.

- [ ] **Step 1: Add the adapter to `auth.ts`**

The current `auth.ts` is:
```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
});
```

Replace it with:
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

`DrizzleAdapter(db)` resolves the `user`/`account`/`session`/`verificationToken` tables by their default names, which match `lib/db/schema.ts`. If sign-in later errors that a table can't be found, pass the tables explicitly: `DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens })` (importing them from `@/lib/db/schema`).

- [ ] **Step 2: Verify the build**

```bash
npm run build
```
Expected: build succeeds. This is the first build that imports `lib/db/index.ts` through the auth route, so it constructs the Neon client — `DATABASE_URL` must now be set (Task 4). A valid connection-string format is sufficient; the build runs no queries. If the build fails with a missing/invalid `DATABASE_URL`, complete Task 4 first.

- [ ] **Step 3: Commit**

```bash
git add auth.ts
git commit -m "feat(db): wire Drizzle adapter into Auth.js (keep JWT sessions)"
```

---

## Task 6: Apply the migration and verify the sign-in round-trip

This task creates the tables in Neon and confirms the Phase 1 outcome: signing in writes a durable `user` row. It needs the real `.env.local` from Task 4.

**Files:** none (migration + verification only)

- [ ] **Step 1: Apply the migration to Neon**

```bash
npm run db:migrate
```
Expected: drizzle-kit connects using `DATABASE_URL` and applies `0000_*.sql`; output reports the migration as applied. Re-running prints nothing to apply (idempotent).

- [ ] **Step 2: Confirm the tables exist**

Open the Neon Console → your project → **SQL Editor**, and run:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```
Expected: `account`, `game_states`, `session`, `user`, `verificationToken` are all listed. (Alternatively `npm run db:studio` opens Drizzle Studio at https://local.drizzle.studio.)

- [ ] **Step 3: Sign in with Google**

```bash
npm run dev
```
Open http://localhost:3000 and click **Sign in** → complete the Google consent → you are returned signed in (top-bar button reads **Sign out**, as in Phase 0).

- [ ] **Step 4: Confirm a `user` row was written**

Back in the Neon SQL Editor:
```sql
SELECT id, name, email FROM "user";
SELECT provider, "providerAccountId" FROM "account";
```
Expected: one `user` row with your Google name/email, and one `account` row with `provider = 'google'`. This is the Phase 1 outcome — a durable user persisted by the adapter even though sessions are JWT. `game_states` stays empty (populated in Phase 2). Stop the dev server.

- [ ] **Step 5: Confirm anonymous play is still unchanged**

While signed out (or in a fresh private window without signing in), add a task and complete it. Expected: XP/coins/toast behave exactly as before and a reload restores them from `localStorage` (`battlepass.state.v1`). Phase 1 must not alter anonymous behavior.

- [ ] **Step 6: Final build gate**

```bash
npm run build
```
Expected: clean build. Phase 1 is complete.

---

## Self-review notes (against the spec)

- **Spec Phase 1 bullets — coverage:** provision Neon + `DATABASE_URL` (Task 4) · add `drizzle-orm`, `drizzle-kit`, `@auth/drizzle-adapter`, `@neondatabase/serverless` (Task 1) · `lib/db/schema.ts` with the four Auth.js tables + `game_states` (Task 2) · `lib/db/index.ts` Drizzle client over the Neon serverless driver (Task 3) · `drizzle.config.ts` (Task 3) · wire `DrizzleAdapter(db)` keeping `session.strategy = "jwt"` (Task 5) · generate + run the first migration (Tasks 3 + 6). All covered.
- **Spec data model:** `game_states` matches the spec's `pgTable` exactly — `userId` PK referencing `users.id` `onDelete: cascade`, `data jsonb $type<GameState> notNull`, `updatedAt timestamptz defaultNow notNull` (Task 2).
- **Spec outcome ("signing in creates a durable user row; no gameplay change"):** verified in Task 6 Steps 4–5. `lib/store.tsx` and all gameplay code are untouched.
- **Spec security note ("`userId` references `users.id` with `onDelete: cascade`"):** enforced in the `game_states` and `account`/`session` FKs (Task 2) and exercised by the migration (Task 6).
- **Spec security note ("secrets stay in env, never committed"):** `DATABASE_URL` lives only in `.env.local`; `.gitignore` already covers `.env*`; re-checked in Task 4 Step 4.
- **Out of scope for Phase 1 (correctly absent):** `/api/state` route, `StateRepository`/`lib/store.tsx` sync changes, the merge rule, and `session`/`jwt` callbacks — all Phase 2.
- **Type/name consistency:** `db` is the named export of `lib/db/index.ts`, consumed in `auth.ts` and `drizzle.config.ts` references the same schema path; `users`/`accounts`/`sessions`/`verificationTokens`/`gameStates` export names are used consistently; `gameStates.data` is typed `GameState` imported from `@/lib/types` (the same type `lib/store.tsx` uses).
- **Build-vs-credentials ordering:** Tasks 1–3 are verifiable offline (type-check never executes `neon()`; `drizzle-kit generate` never connects). The first build that needs `DATABASE_URL` is Task 5 Step 2, immediately after the owner supplies it in Task 4 — the deliberate pause point.

# Phase 0 — Google OAuth (Auth.js v5, zero database) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with Google" to Battlepass using Auth.js v5 with JWT sessions, so a real authenticated session exists in the app — with no database and no change to anonymous local play.

**Architecture:** Auth.js v5 (`next-auth@beta`) is configured in a root `auth.ts` that exports `{ handlers, auth, signIn, signOut }`. A catch-all route (`app/api/auth/[...nextauth]/route.ts`) serves the OAuth flow. Sessions use the `jwt` strategy, so no database is required. A client `SessionProvider` (`components/Providers.tsx`) is wired into the root layout, and a small `AuthControl` button in the existing `TopBar` drives `signIn`/`signOut` via `useSession`. The `GameProvider` store and localStorage persistence are left completely untouched in this phase.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Auth.js v5 (`next-auth@beta`) · Google OAuth provider · JWT sessions.

---

## Testing approach (read first)

This project has **no test framework** and CLAUDE.md designates `npm run build` (which runs type-checking + lint) as the correctness gate. **Do not add a test framework.** Each task is verified by:

1. `npm run build` — must complete with no type or lint errors.
2. Targeted manual checks in the browser via `npm run dev` where noted.

Steps follow a write → verify (build) → manual-check → commit rhythm instead of a unit-test TDD loop.

## Prerequisites for the human owner

Two steps require the project owner and cannot be done by an agent. They are written out fully in **Task 2**:

- Creating the Google Cloud OAuth client (Client ID + Secret).
- Generating `AUTH_SECRET` and placing all three secrets in `.env.local`.

An agent executing this plan should complete Task 1, then **pause at Task 2** and ask the owner to supply credentials before continuing, because Task 8's end-to-end verification cannot pass without them. Tasks 3–7 (all code) can be written before credentials exist; only the live sign-in check in Task 8 needs them.

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `.gitignore` | Create | Keep `node_modules`, `.next`, and **all `.env*` secret files** out of version control. |
| `.env.example` | Create | Document required env vars (no secret values). Safe to commit. |
| `.env.local` | Create (owner, not committed) | Real secret values for local dev. |
| `auth.ts` | Create | Auth.js v5 config; exports `handlers`, `auth`, `signIn`, `signOut`. |
| `app/api/auth/[...nextauth]/route.ts` | Create | Re-exports Auth.js `handlers` as `GET`/`POST`. |
| `components/Providers.tsx` | Create | Client `SessionProvider` wrapper. |
| `app/layout.tsx` | Modify | Wrap `{children}` in `<Providers>`. |
| `components/AuthControl.tsx` | Create | Sign in / Sign out button using `useSession`/`signIn`/`signOut`. |
| `components/TopBar.tsx` | Modify | Render `<AuthControl />` next to the coin pill. |
| `app/globals.css` | Modify | Add `.topbar-right` flex container. |
| `package.json` | Modify (via `npm install`) | Add `next-auth` dependency. |

---

## Task 1: Initialize git and add `.gitignore`

This repo is not yet a git repository. Initialize it first so commits work and, critically, so secret env files are ignored **before** they are ever created.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Initialize the repository**

Run:
```bash
git init
```
Expected: `Initialized empty Git repository in /Users/htoomyat/Projects/Battlepass/.git/`

- [ ] **Step 2: Create `.gitignore`**

Create `.gitignore` with the standard Next.js ignore set (note the `.env*` line — this is what keeps secrets out of git):

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.*

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*
!.env.example

# typescript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Verify env files would be ignored**

Run:
```bash
git check-ignore -v .env.local .env.example 2>&1 || true
```
Expected: `.env.local` is reported as ignored by the `.env*` rule; `.env.example` is **not** ignored (the `!.env.example` negation re-includes it). These files don't exist yet — `git check-ignore` evaluates the path against the rules regardless.

- [ ] **Step 4: Make the initial commit**

```bash
git add -A
git commit -m "chore: initialize git with Next.js .gitignore"
```
Expected: a commit is created. Confirm `.env.local` is absent from the tree with `git ls-files | grep env` (should show nothing, or only `.env.example` later).

---

## Task 2: Google OAuth credentials and environment variables

**Owner-only manual setup.** An agent should create `.env.example` (Steps 1–2), then stop and hand Steps 3–5 to the project owner.

**Files:**
- Create: `.env.example` (committed)
- Create: `.env.local` (owner; not committed)

- [ ] **Step 1: Create `.env.example`**

```dotenv
# Auth.js session-encryption secret.
# Generate with:  npx auth secret      (writes to .env.local automatically)
# or:             openssl rand -base64 33
AUTH_SECRET=

# Google OAuth 2.0 client credentials.
# Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID (Web application)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

- [ ] **Step 2: Commit `.env.example`**

```bash
git add .env.example
git commit -m "docs: document required auth env vars"
```

- [ ] **Step 3 (owner): Create the Google OAuth client**

In [Google Cloud Console](https://console.cloud.google.com/):
1. Create or select a project.
2. **APIs & Services → OAuth consent screen** → User type **External** → fill App name, User support email, Developer contact email → Save. While the app is in **Testing**, add your own Google account under **Test users**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type **Web application**.
4. **Authorized JavaScript origins:** `http://localhost:3000`
5. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`
   (When you deploy, also add `https://<your-domain>` as an origin and `https://<your-domain>/api/auth/callback/google` as a redirect URI.)
6. Click **Create** and copy the **Client ID** and **Client secret**.

- [ ] **Step 4 (owner): Generate `AUTH_SECRET` and write `.env.local`**

From the repo root:
```bash
npx auth secret
```
This creates/updates `.env.local` with a generated `AUTH_SECRET`. Then add the Google values so `.env.local` reads:
```dotenv
AUTH_SECRET=<generated value>
AUTH_GOOGLE_ID=<your client id>
AUTH_GOOGLE_SECRET=<your client secret>
```
(If you prefer not to use `npx auth secret`, generate the secret with `openssl rand -base64 33` and paste it in.)

- [ ] **Step 5 (owner): Confirm `.env.local` is ignored by git**

```bash
git status --short
```
Expected: `.env.local` does **not** appear. If it does, stop and fix `.gitignore` before continuing — secrets must never be committed.

---

## Task 3: Install Auth.js and create the auth config

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `auth.ts` (repo root)

- [ ] **Step 1: Install `next-auth` v5 (beta)**

```bash
npm install next-auth@beta
```
Expected: `next-auth` appears under `dependencies` in `package.json` (a `5.0.0-beta.x` version). If npm errors on React 19 peer ranges, re-run with `npm install next-auth@beta --legacy-peer-deps`.

- [ ] **Step 2: Create `auth.ts`**

Create `auth.ts` in the repo root. Auth.js v5 auto-reads `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` from the environment, so the `Google` provider needs no explicit arguments.

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
});
```

- [ ] **Step 3: Type-check the new file**

Run:
```bash
npm run build
```
Expected: build completes with no type errors. (It compiles even before credentials exist; the values are only read at request time.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json auth.ts
git commit -m "feat(auth): add Auth.js v5 config with Google provider (JWT sessions)"
```

---

## Task 4: Add the Auth.js route handler

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create the catch-all route**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 2: Verify the build**

Run:
```bash
npm run build
```
Expected: build succeeds and the route `/api/auth/[...nextauth]` appears in the route list as a dynamic ƒ route.

- [ ] **Step 3: Smoke-test the providers endpoint**

Run the dev server and hit the providers endpoint (this works without valid Google credentials — it only lists configured providers):
```bash
npm run dev
```
In another terminal:
```bash
curl -s http://localhost:3000/api/auth/providers
```
Expected: JSON containing a `google` entry, e.g. `{"google":{"id":"google","name":"Google",...}}`. Stop the dev server afterward (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add "app/api/auth/[...nextauth]/route.ts"
git commit -m "feat(auth): expose Auth.js route handler"
```

---

## Task 5: Add SessionProvider and wire it into the root layout

**Files:**
- Create: `components/Providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the client `Providers` wrapper**

Create `components/Providers.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Wrap `{children}` in the root layout**

In `app/layout.tsx`, add the import and wrap the body content. The current body is `<body>{children}</body>`.

Add near the top (after the existing `import "./globals.css";`):
```tsx
import Providers from "@/components/Providers";
```

Replace:
```tsx
      <body>{children}</body>
```
with:
```tsx
      <body>
        <Providers>{children}</Providers>
      </body>
```

`app/layout.tsx` stays a server component; only `Providers` is a client component. This preserves the SSR pattern CLAUDE.md warns about.

- [ ] **Step 3: Verify the build**

Run:
```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/Providers.tsx app/layout.tsx
git commit -m "feat(auth): provide SessionProvider via root layout"
```

---

## Task 6: Create the AuthControl button

**Files:**
- Create: `components/AuthControl.tsx`

- [ ] **Step 1: Create the component**

Create `components/AuthControl.tsx`. It reflects the three session states (`loading`, signed-in, signed-out) and reuses the existing `.btn` / `.btn-primary` classes from `app/globals.css`.

```tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthControl() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <button className="btn" disabled aria-label="Loading session">
        …
      </button>
    );
  }

  if (session?.user) {
    return (
      <button
        className="btn"
        onClick={() => signOut()}
        title={session.user.email ?? undefined}
      >
        Sign out
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={() => signIn("google")}>
      Sign in
    </button>
  );
}
```

- [ ] **Step 2: Verify the build**

Run:
```bash
npm run build
```
Expected: build succeeds. (The component is not rendered anywhere yet; this only confirms it type-checks.)

- [ ] **Step 3: Commit**

```bash
git add components/AuthControl.tsx
git commit -m "feat(auth): add sign in / sign out control"
```

---

## Task 7: Render AuthControl in the TopBar

**Files:**
- Modify: `components/TopBar.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Add the `.topbar-right` style**

In `app/globals.css`, immediately after the `.topbar { … }` block (which ends at the line with the closing `}` after `margin-bottom: 16px;`), add:

```css
.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
```

- [ ] **Step 2: Import AuthControl in TopBar**

In `components/TopBar.tsx`, add below the existing `import { useGame } from "@/lib/store";` line:

```tsx
import AuthControl from "@/components/AuthControl";
```

- [ ] **Step 3: Wrap the coin pill and AuthControl in a flex container**

The `.topbar` is a two-column grid (`1fr auto`), so the right side must be a single element. Replace this block in `components/TopBar.tsx`:

```tsx
      <div className="coin-pill" title="Coins earned">
        <span className="coin-dot" />
        {state.coins.toLocaleString()}
      </div>
```

with:

```tsx
      <div className="topbar-right">
        <div className="coin-pill" title="Coins earned">
          <span className="coin-dot" />
          {state.coins.toLocaleString()}
        </div>
        <AuthControl />
      </div>
```

- [ ] **Step 4: Verify the build**

Run:
```bash
npm run build
```
Expected: build succeeds with no type or lint errors.

- [ ] **Step 5: Visual check in the browser**

```bash
npm run dev
```
Open http://localhost:3000. Expected: a **Sign in** button (brand-gradient `.btn-primary`) appears to the right of the coin pill in the top bar. The level bar, XP, and coins still render exactly as before. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add components/TopBar.tsx app/globals.css
git commit -m "feat(auth): show AuthControl in the top bar"
```

---

## Task 8: End-to-end verification (requires owner credentials)

This task confirms the full OAuth round-trip. It needs the real `.env.local` from Task 2.

**Files:** none (verification only)

- [ ] **Step 1: Confirm credentials are present**

```bash
git check-ignore .env.local && test -f .env.local && echo "env present and ignored"
```
Expected: prints `env present and ignored`. If `.env.local` is missing, complete Task 2 Steps 3–4 first.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```
Open http://localhost:3000.

- [ ] **Step 3: Sign in with Google**

Click **Sign in**. Expected: redirect to the Google consent screen, then back to http://localhost:3000. The top-bar button now reads **Sign out**, and hovering it shows your Google email as the tooltip.

- [ ] **Step 4: Confirm the session endpoint**

In another terminal:
```bash
curl -s http://localhost:3000/api/auth/session
```
Expected: JSON with a `user` object containing your `name`/`email` (not an empty `{}`). This confirms the JWT session is live with no database involved.

- [ ] **Step 5: Sign out**

Click **Sign out**. Expected: the button returns to **Sign in**, and `curl http://localhost:3000/api/auth/session` now returns `null` or `{}`.

- [ ] **Step 6: Confirm anonymous play is unchanged**

While signed out, add a task and complete it. Expected: XP/coins/toast behave exactly as before, and a reload restores them from localStorage (`battlepass.state.v1`). Phase 0 must not alter anonymous behavior. Stop the dev server.

- [ ] **Step 7: Final build gate**

```bash
npm run build
```
Expected: clean build. Phase 0 is complete.

---

## Self-review notes (against the spec)

- **Spec Phase 0 bullets — coverage:** `next-auth@beta` (Task 3) · `auth.ts` exporting `{handlers, auth, signIn, signOut}` with Google + JWT (Task 3) · `[...nextauth]/route.ts` re-exporting handlers as GET/POST (Task 4) · client `SessionProvider` in layout (Task 5) · sign in/out control in TopBar via `useSession`/`signIn`/`signOut` (Tasks 6–7) · env vars `AUTH_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (Task 2). All covered.
- **Spec security note** ("secrets stay in env, never committed"): enforced up front by Task 1's `.gitignore` (`.env*` with `!.env.example`) and re-checked in Task 2 Step 5 and Task 8 Step 1.
- **Spec SSR risk note:** layout stays a server component; only `Providers`/`AuthControl` are client components — deterministic `initialState` hydration in `lib/store.tsx` is untouched (Phase 0 changes no store code).
- **Out of scope for Phase 0 (correctly absent):** database, Drizzle, `@auth/drizzle-adapter`, `/api/state`, and any `lib/store.tsx` sync changes — those are Phases 1–2.
- **Type/name consistency:** `Providers` (default export) imported as default in layout; `AuthControl` (default export) imported as default in TopBar; `handlers` named export consumed in the route and `signIn`/`signOut` from `next-auth/react` in the client component (not from `auth.ts`, which is server-side) — correct split for v5.

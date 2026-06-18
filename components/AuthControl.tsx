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

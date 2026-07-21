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
        className="icon-btn"
        onClick={() => signOut()}
        aria-label="Sign out"
        title={
          session.user.email ? `Sign out (${session.user.email})` : "Sign out"
        }
      >
        {/* exit glyph: door frame open on the right + arrow leaving */}
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M9 2H3v12h6" />
          <path d="M7 8h7M11 5l3 3-3 3" />
        </svg>
      </button>
    );
  }

  return (
    <button className="btn btn-primary" onClick={() => signIn("google")}>
      Sign in
    </button>
  );
}

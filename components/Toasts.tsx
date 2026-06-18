"use client";

import { useGame } from "@/lib/store";

export default function Toasts() {
  const { toasts } = useGame();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

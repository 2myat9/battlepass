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

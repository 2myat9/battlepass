/* ------------------------------------------------------------------ *
 *  Calendar helpers for the monthly battle-pass season and the
 *  daily streak.
 *
 *  All values are the user's LOCAL calendar dates, encoded as plain
 *  strings — "YYYY-MM-DD" for days, "YYYY-MM" for months — so they
 *  compare with `===` and survive JSON round-trips unchanged.
 * ------------------------------------------------------------------ */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar day, e.g. "2026-07-12". */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar day before `day` ("YYYY-MM-DD"). */
export function prevDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d - 1));
}

/** Local month, e.g. "2026-07". One battle-pass season per month. */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Days left in the current month's pass, counting today. */
export function daysLeftInMonth(date = new Date()): number {
  const lastDate = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return lastDate - date.getDate() + 1;
}

/** Short label for the next season reset, e.g. "Aug 1". */
export function nextResetLabel(date = new Date()): string {
  const first = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${first.toLocaleString("en-US", { month: "short" })} 1`;
}

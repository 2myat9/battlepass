"use client";

/**
 * Progress as countable units: a row of flat square cells that fill
 * with ink, the leading cell in live cobalt. The design system's
 * signature element — use it wherever progress is shown.
 */
export default function Meter({
  progress,
  cells = 20,
}: {
  progress: number;
  cells?: number;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const filled =
    clamped === 0 ? 0 : Math.max(1, Math.round(clamped * cells));

  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={
            i === filled - 1 ? "on tip" : i < filled ? "on" : undefined
          }
        />
      ))}
    </div>
  );
}

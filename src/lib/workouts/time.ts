/** Return the number of whole seconds until an absolute due time. */
export function secondsRemaining(dueAt: Date | string | number, now = Date.now()): number {
  const due = dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return 0;
  return Math.max(0, Math.ceil((due - now) / 1000));
}

export function isDue(dueAt: Date | string | number, now = Date.now()): boolean {
  const due = dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
  return !Number.isFinite(due) || due <= now;
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

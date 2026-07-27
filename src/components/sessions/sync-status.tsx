"use client";

import type { SyncState } from "@/lib/offline-workouts/models";

export interface SyncStatusProps {
  state: SyncState;
  pendingCount?: number;
  errorMessage?: string | null;
  className?: string;
}

const LABELS: Record<SyncState, string> = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing…",
  "sync-pending": "Sync pending",
  "sync-conflicted": "Sync conflict",
};

/** Small, text-first status surface for the active workout header. */
export function SyncStatus({
  state,
  pendingCount = 0,
  errorMessage,
  className,
}: SyncStatusProps) {
  const suffix = pendingCount > 0 ? ` (${pendingCount})` : "";
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      data-sync-state={state}
    >
      <span>{LABELS[state]}{suffix}</span>
      {state === "sync-conflicted" && errorMessage ? (
        <span className="sr-only">{errorMessage}</span>
      ) : null}
    </div>
  );
}

export default SyncStatus;

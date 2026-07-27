/**
 * Client-only records used by the offline workout store.
 *
 * These records are deliberately independent from the server ORM types. The
 * server can change its response shape without invalidating data already
 * queued on a device. Commands use the shared server envelope so online and
 * offline writes cannot drift.
 */

import type { CommandEnvelope, WorkoutCommand } from "@/lib/workouts/contracts";

export type { CommandEnvelope, WorkoutCommand };

export type LocalWorkoutStatus =
  | "Active"
  | "Completed"
  | "Partial"
  | "Discarded"
  | "Sync-pending"
  | "Sync-conflicted";

export type SyncState =
  | "online"
  | "offline"
  | "syncing"
  | "sync-pending"
  | "sync-conflicted";

export type SyncErrorCode =
  | "NETWORK_ERROR"
  | "STALE_REVISION"
  | "STALE_CONTROLLER"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export interface DeviceRecord {
  /** The single stable identity used by controller writes. */
  id: "device";
  deviceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineWorkoutSnapshot<TData = unknown> {
  sessionId: string;
  /** Last server revision represented by this snapshot. */
  revision: number;
  controllerEpoch: number;
  controllerDeviceId: string;
  status: LocalWorkoutStatus;
  data: TData;
  /** Current rest/timer state, if one exists. */
  rest?: RestTimestamp | null;
  updatedAt: number;
}

export interface RestTimestamp {
  restId?: string;
  startedAt: number;
  dueAt: number;
  /** Invalidated rests must not be sent as late alerts after reconnect. */
  invalidatedAt?: number;
}

export interface OutboxEntry {
  /** IndexedDB key. Equal to operationId so retries are idempotent. */
  operationId: string;
  sessionId: string;
  controllerEpoch: number;
  controllerDeviceId: string;
  expectedRevision: number;
  envelope: CommandEnvelope;
  sequence: number;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
}

export interface SyncMetadata {
  sessionId: string;
  state: SyncState;
  lastAcknowledgedRevision: number;
  errorCode?: SyncErrorCode;
  errorMessage?: string;
  retryAt?: number;
  updatedAt: number;
}

export interface TimerTimestamp {
  /** IndexedDB key: `${sessionId}:${name}`. */
  id: string;
  sessionId: string;
  name: string;
  startedAt?: number;
  dueAt?: number;
  invalidatedAt?: number;
  updatedAt: number;
}

export interface RecoveryArchive<TData = unknown> {
  /** One archive is retained for each session until explicit deletion. */
  sessionId: string;
  archivedAt: number;
  reason: string;
  snapshot: OfflineWorkoutSnapshot<TData> | null;
  outbox: Array<OutboxEntry>;
  /** A stable, human-readable export payload generated at archive time. */
  exportText: string;
}

export interface CommandReceipt<TSnapshot = unknown> {
  operationId: string;
  revision: number;
  snapshot?: OfflineWorkoutSnapshot<TSnapshot> | TSnapshot | null;
}

export interface SyncResponse<TSnapshot = unknown> {
  receipt?: CommandReceipt<TSnapshot>;
  revision?: number;
  snapshot?: OfflineWorkoutSnapshot<TSnapshot> | TSnapshot | null;
  /** Server errors should use one of the stable conflict codes. */
  errorCode?: SyncErrorCode | string;
  errorMessage?: string;
}

export interface SyncConflictError extends Error {
  code: "STALE_REVISION" | "STALE_CONTROLLER";
}

export function isTerminalStatus(status: LocalWorkoutStatus): boolean {
  return (
    status === "Completed" ||
    status === "Partial" ||
    status === "Discarded" ||
    status === "Sync-pending" ||
    status === "Sync-conflicted"
  );
}

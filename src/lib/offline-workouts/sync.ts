import {
  getSnapshot,
  listOutbox,
  removeOutboxEntry,
  saveSnapshot,
  saveSyncMetadata,
  updateOutboxAttempt,
} from "./db";
import {
  CommandReceipt,
  OfflineWorkoutSnapshot,
  OutboxEntry,
  SyncConflictError,
  SyncErrorCode,
  SyncResponse,
} from "./models";

export type CommandSender<TSnapshot = unknown> = (
  entry: OutboxEntry
) => Promise<SyncResponse<TSnapshot>>;

export interface SyncOptions<TSnapshot = unknown> {
  sessionId: string;
  send: CommandSender<TSnapshot>;
  /** Maximum attempts for one operation, including its first send. */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  now?: () => number;
  onStateChange?: (state: "syncing" | "sync-pending" | "online" | "sync-conflicted") => void;
}

export interface SyncResult<TSnapshot = unknown> {
  acknowledged: string[];
  remaining: OutboxEntry[];
  state: "online" | "sync-pending" | "sync-conflicted";
  snapshot?: OfflineWorkoutSnapshot<TSnapshot>;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 250;
const DEFAULT_MAX_DELAY = 5_000;

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function errorCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as { code?: unknown; errorCode?: unknown; data?: unknown };
  if (typeof candidate.code === "string") return candidate.code;
  if (typeof candidate.errorCode === "string") return candidate.errorCode;
  if (candidate.data && typeof candidate.data === "object") {
    const nested = candidate.data as { code?: unknown; errorCode?: unknown };
    if (typeof nested.code === "string") return nested.code;
    if (typeof nested.errorCode === "string") return nested.errorCode;
  }
  return undefined;
}

function isConflictCode(code: string | undefined): boolean {
  return (
    code === "STALE_REVISION" ||
    code === "STALE_CONTROLLER" ||
    code === "STALE_EPOCH" ||
    code === "SYNC_CONFLICT"
  );
}

function isLikelyNetworkError(error: unknown): boolean {
  const code = errorCode(error);
  if (code && isConflictCode(code)) return false;
  if (code === "VALIDATION_ERROR" || code === "BAD_REQUEST") return false;
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (status >= 400 && status < 500) return false;
  }
  return true;
}

function isOfflineSnapshot<TData>(value: unknown): value is OfflineWorkoutSnapshot<TData> {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as OfflineWorkoutSnapshot).sessionId === "string" &&
    typeof (value as OfflineWorkoutSnapshot).revision === "number" &&
    "data" in value
  );
}

function responseParts<TSnapshot>(
  response: SyncResponse<TSnapshot>
): { revision?: number; snapshot?: OfflineWorkoutSnapshot<TSnapshot> | TSnapshot | null; code?: string } {
  const receipt: CommandReceipt<TSnapshot> | undefined = response.receipt;
  return {
    revision: receipt?.revision ?? response.revision,
    snapshot: receipt?.snapshot ?? response.snapshot,
    code: response.errorCode,
  };
}

function makeConflictError(code: "STALE_REVISION" | "STALE_CONTROLLER", message: string): SyncConflictError {
  const error = new Error(message) as SyncConflictError;
  error.code = code;
  return error;
}

async function markConflicted(
  sessionId: string,
  code: SyncErrorCode,
  message: string,
  now: number,
  onStateChange?: SyncOptions["onStateChange"]
): Promise<void> {
  const snapshot = await getSnapshot(sessionId);
  if (snapshot) {
    await saveSnapshot({
      ...snapshot,
      status: "Sync-conflicted",
      updatedAt: now,
    });
  }
  await saveSyncMetadata({
    sessionId,
    state: "sync-conflicted",
    lastAcknowledgedRevision: snapshot?.revision ?? 0,
    errorCode: code,
    errorMessage: message,
    updatedAt: now,
  });
  onStateChange?.("sync-conflicted");
}

/**
 * Drain one workout's outbox in sequence. A failed entry always blocks later
 * entries. Acknowledged entries are removed only after their server receipt is
 * written locally.
 */
export async function syncOutbox<TSnapshot = unknown>(
  options: SyncOptions<TSnapshot>
): Promise<SyncResult<TSnapshot>> {
  const maxRetries = Math.max(1, options.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseDelay = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY);
  const maxDelay = Math.max(baseDelay, options.maxDelayMs ?? DEFAULT_MAX_DELAY);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const acknowledged: string[] = [];
  let localSnapshot = await getSnapshot<TSnapshot>(options.sessionId);

  options.onStateChange?.("syncing");
  await saveSyncMetadata({
    sessionId: options.sessionId,
    state: "syncing",
    lastAcknowledgedRevision: localSnapshot?.revision ?? 0,
    updatedAt: now(),
  });

  let entries = await listOutbox(options.sessionId);
  if (entries.length === 0) {
    await saveSyncMetadata({
      sessionId: options.sessionId,
      state: "online",
      lastAcknowledgedRevision: localSnapshot?.revision ?? 0,
      updatedAt: now(),
    });
    options.onStateChange?.("online");
    return { acknowledged, remaining: [], state: "online", snapshot: localSnapshot };
  }

  for (const queued of entries) {
    let response: SyncResponse<TSnapshot> | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      const entry = await updateOutboxAttempt(queued.operationId);
      if (!entry) break;
      try {
        response = await options.send(entry);
        const parts = responseParts(response);
        if (isConflictCode(parts.code)) {
          const code = parts.code === "STALE_CONTROLLER" || parts.code === "STALE_EPOCH" ? "STALE_CONTROLLER" : "STALE_REVISION";
          const message = response.errorMessage ?? `Server rejected ${code.toLowerCase()}`;
          await markConflicted(options.sessionId, code, message, now(), options.onStateChange);
          throw makeConflictError(code, message);
        }
        break;
      } catch (error) {
        lastError = error;
        const code = errorCode(error);
        if (isConflictCode(code)) {
          const conflictCode = code === "STALE_CONTROLLER" || code === "STALE_EPOCH" ? "STALE_CONTROLLER" : "STALE_REVISION";
          const message = error instanceof Error ? error.message : `Server rejected ${conflictCode.toLowerCase()}`;
          await markConflicted(options.sessionId, conflictCode, message, now(), options.onStateChange);
          throw makeConflictError(conflictCode, message);
        }
        if (!isLikelyNetworkError(error) || attempt + 1 >= maxRetries) break;
        const delay = Math.min(maxDelay, baseDelay * 2 ** attempt);
        await sleep(delay);
      }
    }

    if (!response) {
      const message = lastError instanceof Error ? lastError.message : "Unable to sync workout";
      await saveSyncMetadata({
        sessionId: options.sessionId,
        state: "sync-pending",
        lastAcknowledgedRevision: localSnapshot?.revision ?? 0,
        errorCode: "NETWORK_ERROR",
        errorMessage: message,
        retryAt: now() + baseDelay,
        updatedAt: now(),
      });
      options.onStateChange?.("sync-pending");
      entries = await listOutbox(options.sessionId);
      return {
        acknowledged,
        remaining: entries,
        state: "sync-pending",
        snapshot: localSnapshot,
      };
    }

    const parts = responseParts(response);
    const nextRevision = parts.revision ?? localSnapshot?.revision ?? queued.expectedRevision + 1;
    if (parts.snapshot !== undefined && parts.snapshot !== null) {
      if (isOfflineSnapshot<TSnapshot>(parts.snapshot)) {
        localSnapshot = parts.snapshot;
      } else if (localSnapshot) {
        localSnapshot = {
          ...localSnapshot,
          revision: nextRevision,
          data: parts.snapshot as TSnapshot,
          updatedAt: now(),
        };
      }
      if (localSnapshot) {
        await saveSnapshot({ ...localSnapshot, revision: nextRevision, updatedAt: now() });
      }
    } else if (localSnapshot) {
      localSnapshot = { ...localSnapshot, revision: nextRevision, updatedAt: now() };
      await saveSnapshot(localSnapshot);
    }
    await removeOutboxEntry(queued.operationId);
    acknowledged.push(queued.operationId);
    await saveSyncMetadata({
      sessionId: options.sessionId,
      state: "syncing",
      lastAcknowledgedRevision: nextRevision,
      errorCode: undefined,
      errorMessage: undefined,
      retryAt: undefined,
      updatedAt: now(),
    });
  }

  entries = await listOutbox(options.sessionId);
  const state = entries.length > 0 ? "sync-pending" : "online";
  await saveSyncMetadata({
    sessionId: options.sessionId,
    state,
    lastAcknowledgedRevision: localSnapshot?.revision ?? 0,
    updatedAt: now(),
  });
  options.onStateChange?.(state);
  return { acknowledged, remaining: entries, state, snapshot: localSnapshot };
}

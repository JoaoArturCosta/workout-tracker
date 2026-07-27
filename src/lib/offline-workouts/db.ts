import { DBSchema, IDBPDatabase, openDB } from "idb";
import {
  DeviceRecord,
  OfflineWorkoutSnapshot,
  OutboxEntry,
  RecoveryArchive,
  SyncMetadata,
  TimerTimestamp,
} from "./models";

export const OFFLINE_DB_NAME = "workout-tracker-offline";
export const OFFLINE_DB_VERSION = 1;

export const OFFLINE_STORES = {
  device: "device",
  snapshots: "snapshots",
  outbox: "outbox",
  syncMetadata: "syncMetadata",
  timers: "timers",
  recovery: "recovery",
} as const;

interface OfflineSchema extends DBSchema {
  device: {
    key: "device";
    value: DeviceRecord;
  };
  snapshots: {
    key: string;
    value: OfflineWorkoutSnapshot;
  };
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: {
      "by-session-sequence": [string, number];
      "by-session": string;
    };
  };
  syncMetadata: {
    key: string;
    value: SyncMetadata;
  };
  timers: {
    key: string;
    value: TimerTimestamp;
    indexes: { "by-session": string };
  };
  recovery: {
    key: string;
    value: RecoveryArchive;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | undefined;

function assertIndexedDb(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("Offline workout storage is only available in a browser");
  }
}

/** Open the versioned local database. The promise is shared for one tab. */
export function getOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  assertIndexedDb();
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(OFFLINE_STORES.device)) {
          db.createObjectStore(OFFLINE_STORES.device);
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORES.snapshots)) {
          db.createObjectStore(OFFLINE_STORES.snapshots, { keyPath: "sessionId" });
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORES.outbox)) {
          const outbox = db.createObjectStore(OFFLINE_STORES.outbox, {
            keyPath: "operationId",
          });
          outbox.createIndex("by-session-sequence", ["sessionId", "sequence"]);
          outbox.createIndex("by-session", "sessionId");
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORES.syncMetadata)) {
          db.createObjectStore(OFFLINE_STORES.syncMetadata, { keyPath: "sessionId" });
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORES.timers)) {
          const timers = db.createObjectStore(OFFLINE_STORES.timers, { keyPath: "id" });
          timers.createIndex("by-session", "sessionId");
        }
        if (!db.objectStoreNames.contains(OFFLINE_STORES.recovery)) {
          db.createObjectStore(OFFLINE_STORES.recovery, { keyPath: "sessionId" });
        }
      },
    });
  }
  return dbPromise;
}

/** Close and forget the tab-local handle. Mainly useful after a test reset. */
export async function closeOfflineDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = undefined;
}

/** Delete all local offline data. Call only from an explicit user action. */
export async function deleteOfflineDb(): Promise<void> {
  await closeOfflineDb();
  assertIndexedDb();
  await indexedDB.deleteDatabase(OFFLINE_DB_NAME);
}

function makeDeviceId(): string {
  const runtimeCrypto = (
    globalThis as unknown as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;
  if (runtimeCrypto?.randomUUID) {
    return runtimeCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (runtimeCrypto?.getRandomValues) {
    runtimeCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceRecord(): Promise<DeviceRecord | undefined> {
  return (await getOfflineDb()).get(OFFLINE_STORES.device, "device");
}

/** Read the stable device ID, creating it once per site-data partition. */
export async function getDeviceId(): Promise<string> {
  const db = await getOfflineDb();
  const existing = await db.get(OFFLINE_STORES.device, "device");
  if (existing) return existing.deviceId;

  const now = Date.now();
  const record: DeviceRecord = {
    id: "device",
    deviceId: makeDeviceId(),
    createdAt: now,
    updatedAt: now,
  };
  const tx = db.transaction(OFFLINE_STORES.device, "readwrite");
  const current = await tx.store.get("device");
  if (current) {
    await tx.done;
    return current.deviceId;
  }
  await tx.store.put(record, "device");
  await tx.done;
  return record.deviceId;
}

export async function saveSnapshot<TData>(
  snapshot: OfflineWorkoutSnapshot<TData>
): Promise<void> {
  await (await getOfflineDb()).put(OFFLINE_STORES.snapshots, {
    ...snapshot,
    updatedAt: snapshot.updatedAt || Date.now(),
  });
}

export async function getSnapshot<TData = unknown>(
  sessionId: string
): Promise<OfflineWorkoutSnapshot<TData> | undefined> {
  return (await getOfflineDb()).get(OFFLINE_STORES.snapshots, sessionId) as Promise<
    OfflineWorkoutSnapshot<TData> | undefined
  >;
}

export async function deleteSnapshot(sessionId: string): Promise<void> {
  await (await getOfflineDb()).delete(OFFLINE_STORES.snapshots, sessionId);
}

export async function listOutbox(
  sessionId?: string
): Promise<Array<OutboxEntry>> {
  const entries = (await (await getOfflineDb()).getAll(
    OFFLINE_STORES.outbox
  )) as Array<OutboxEntry>;
  return entries
    .filter((entry) => !sessionId || entry.envelope.sessionId === sessionId)
    .sort((left, right) => left.sequence - right.sequence);
}

export async function getOutboxEntry(
  operationId: string
): Promise<OutboxEntry | undefined> {
  return (await (await getOfflineDb()).get(
    OFFLINE_STORES.outbox,
    operationId
  )) as OutboxEntry | undefined;
}

export async function putOutboxEntry(
  entry: OutboxEntry
): Promise<void> {
  await (await getOfflineDb()).put(OFFLINE_STORES.outbox, entry);
}

export async function removeOutboxEntry(operationId: string): Promise<void> {
  await (await getOfflineDb()).delete(OFFLINE_STORES.outbox, operationId);
}

export async function updateOutboxAttempt(
  operationId: string,
  now = Date.now()
): Promise<OutboxEntry | undefined> {
  const db = await getOfflineDb();
  const tx = db.transaction(OFFLINE_STORES.outbox, "readwrite");
  const entry = await tx.store.get(operationId);
  if (!entry) {
    await tx.done;
    return undefined;
  }
  const updated = { ...entry, attempts: entry.attempts + 1, lastAttemptAt: now };
  await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function getSyncMetadata(
  sessionId: string
): Promise<SyncMetadata | undefined> {
  return (await (await getOfflineDb()).get(
    OFFLINE_STORES.syncMetadata,
    sessionId
  )) as SyncMetadata | undefined;
}

export async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  await (await getOfflineDb()).put(OFFLINE_STORES.syncMetadata, {
    ...metadata,
    updatedAt: metadata.updatedAt || Date.now(),
  });
}

export async function saveTimerTimestamp(timer: TimerTimestamp): Promise<void> {
  await (await getOfflineDb()).put(OFFLINE_STORES.timers, timer);
}

export async function getTimerTimestamp(
  sessionId: string,
  name: string
): Promise<TimerTimestamp | undefined> {
  return (await (await getOfflineDb()).get(
    OFFLINE_STORES.timers,
    `${sessionId}:${name}`
  )) as TimerTimestamp | undefined;
}

export async function listTimerTimestamps(
  sessionId: string
): Promise<TimerTimestamp[]> {
  const db = await getOfflineDb();
  return (await db.getAllFromIndex(
    OFFLINE_STORES.timers,
    "by-session",
    sessionId
  )) as TimerTimestamp[];
}

export async function deleteTimerTimestamp(
  sessionId: string,
  name: string
): Promise<void> {
  await (await getOfflineDb()).delete(
    OFFLINE_STORES.timers,
    `${sessionId}:${name}`
  );
}

export async function getRecoveryArchive<TData = unknown>(
  sessionId: string
): Promise<RecoveryArchive<TData> | undefined> {
  return (await (await getOfflineDb()).get(
    OFFLINE_STORES.recovery,
    sessionId
  )) as RecoveryArchive<TData> | undefined;
}

export async function saveRecoveryArchive<TData>(
  archive: RecoveryArchive<TData>
): Promise<void> {
  await (await getOfflineDb()).put(OFFLINE_STORES.recovery, archive);
}

export async function deleteRecoveryArchive(sessionId: string): Promise<void> {
  await (await getOfflineDb()).delete(OFFLINE_STORES.recovery, sessionId);
}

/**
 * Read all records for one workout in one place. This is useful for crash
 * recovery and avoids accidentally exporting a different workout's outbox.
 */
export async function readWorkoutLocalState(sessionId: string): Promise<{
  snapshot: OfflineWorkoutSnapshot | undefined;
  outbox: OutboxEntry[];
  metadata: SyncMetadata | undefined;
}> {
  const [snapshot, outbox, metadata] = await Promise.all([
    getSnapshot(sessionId),
    listOutbox(sessionId),
    getSyncMetadata(sessionId),
  ]);
  return { snapshot, outbox, metadata };
}

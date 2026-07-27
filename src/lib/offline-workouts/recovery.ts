import {
  deleteRecoveryArchive as deleteArchiveRecord,
  getOfflineDb,
  getRecoveryArchive,
  getSnapshot,
  listOutbox,
  saveRecoveryArchive,
  saveSyncMetadata,
} from "./db";
import {
  OfflineWorkoutSnapshot,
  OutboxEntry,
  RecoveryArchive,
} from "./models";

export interface RecoveryArchiveInput<TData = unknown> {
  sessionId: string;
  reason?: string;
  snapshot?: OfflineWorkoutSnapshot<TData> | null;
  outbox?: Array<OutboxEntry>;
}

function formatExport<TData>(
  archive: Omit<RecoveryArchive<TData>, "exportText">
): string {
  const snapshot = archive.snapshot;
  const lines = [
    "Workout recovery archive",
    `Session: ${archive.sessionId}`,
    `Archived: ${new Date(archive.archivedAt).toISOString()}`,
    `Reason: ${archive.reason}`,
    `Local status: ${snapshot?.status ?? "unknown"}`,
    `Local revision: ${snapshot?.revision ?? "unknown"}`,
    `Controller epoch: ${snapshot?.controllerEpoch ?? "unknown"}`,
    `Queued actions: ${archive.outbox.length}`,
    "",
    "Actions:",
  ];
  archive.outbox.forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.envelope.command.type} (operation ${entry.envelope.operationId}, expected revision ${entry.envelope.expectedRevision}, sequence ${entry.sequence})`,
      `   command: ${JSON.stringify(entry.envelope.command)}`
    );
  });
  lines.push("", "Snapshot data:", JSON.stringify(snapshot?.data ?? null, null, 2));
  return lines.join("\n");
}

/** Build a stable support-friendly export without exposing device secrets. */
export function serializeRecoveryArchive<TData>(
  archive: RecoveryArchive<TData>
): string {
  return archive.exportText || formatExport(archive);
}

/**
 * Keep one immutable archive per session. This function does not clear local
 * work; callers can safely invoke it before a resolution action.
 */
export async function createRecoveryArchive<TData = unknown>(
  input: RecoveryArchiveInput<TData>
): Promise<RecoveryArchive<TData>> {
  const existing = await getRecoveryArchive<TData>(input.sessionId);
  if (existing) return existing;
  const snapshot =
    input.snapshot === undefined
      ? await getSnapshot<TData>(input.sessionId)
      : input.snapshot;
  const outbox =
    input.outbox === undefined
      ? await listOutbox(input.sessionId)
      : input.outbox;
  const archiveWithoutText: Omit<RecoveryArchive<TData>, "exportText"> = {
    sessionId: input.sessionId,
    archivedAt: Date.now(),
    reason: input.reason ?? "sync-conflict",
    snapshot: snapshot ?? null,
    outbox: [...outbox],
  };
  const archive: RecoveryArchive<TData> = {
    ...archiveWithoutText,
    exportText: formatExport(archiveWithoutText),
  };
  await saveRecoveryArchive(archive);
  return archive;
}

export const archiveConflict = createRecoveryArchive;

/** Read the one retained archive for a conflicted workout. */
export async function readRecoveryArchive<TData = unknown>(
  sessionId: string
): Promise<RecoveryArchive<TData> | undefined> {
  return getRecoveryArchive<TData>(sessionId);
}

/**
 * Archive the complete local state, then clear only that workout's snapshot and
 * outbox. The writes share one transaction, so an archive failure leaves all
 * local work intact.
 */
export async function archiveAndClearLocal<TData = unknown>(
  input: RecoveryArchiveInput<TData>
): Promise<RecoveryArchive<TData>> {
  const db = await getOfflineDb();
  const existing = await getRecoveryArchive<TData>(input.sessionId);
  const snapshot =
    input.snapshot === undefined
      ? await getSnapshot<TData>(input.sessionId)
      : input.snapshot;
  const outbox =
    input.outbox === undefined
      ? await listOutbox(input.sessionId)
      : input.outbox;
  const archive =
    existing ??
    ({
      sessionId: input.sessionId,
      archivedAt: Date.now(),
      reason: input.reason ?? "sync-conflict",
      snapshot: snapshot ?? null,
      outbox: [...outbox],
      exportText: "",
    } as RecoveryArchive<TData>);
  if (!archive.exportText) archive.exportText = formatExport(archive);

  const tx = db.transaction(["recovery", "snapshots", "outbox"], "readwrite");
  await tx.objectStore("recovery").put(archive);
  await tx.objectStore("snapshots").delete(input.sessionId);
  const queued = await tx.objectStore("outbox").getAll();
  for (const entry of queued) {
    if (entry.envelope.sessionId === input.sessionId) {
      await tx.objectStore("outbox").delete(entry.envelope.operationId);
    }
  }
  await tx.done;
  await saveSyncMetadata({
    sessionId: input.sessionId,
    state: "online",
    lastAcknowledgedRevision: snapshot?.revision ?? 0,
    updatedAt: Date.now(),
  });
  return archive;
}

export interface ResolveServerVersionInput<TData = unknown>
  extends RecoveryArchiveInput<TData> {
  serverSnapshot: OfflineWorkoutSnapshot<TData>;
}

/**
 * Resolve a stale workout by preserving local state before loading the server
 * version. No local data is cleared if the archive transaction fails.
 */
export async function useServerVersion<TData = unknown>(
  input: ResolveServerVersionInput<TData>
): Promise<RecoveryArchive<TData>> {
  const db = await getOfflineDb();
  const existing = await getRecoveryArchive<TData>(input.sessionId);
  const snapshot =
    input.snapshot === undefined
      ? await getSnapshot<TData>(input.sessionId)
      : input.snapshot;
  const outbox =
    input.outbox === undefined
      ? await listOutbox(input.sessionId)
      : input.outbox;
  const archive =
    existing ??
    ({
      sessionId: input.sessionId,
      archivedAt: Date.now(),
      reason: input.reason ?? "sync-conflict",
      snapshot: snapshot ?? null,
      outbox: [...outbox],
      exportText: "",
    } as RecoveryArchive<TData>);
  if (!archive.exportText) archive.exportText = formatExport(archive);

  const tx = db.transaction(["recovery", "snapshots", "outbox"], "readwrite");
  await tx.objectStore("recovery").put(archive);
  await tx.objectStore("snapshots").put(input.serverSnapshot);
  const queued = await tx.objectStore("outbox").getAll();
  for (const entry of queued) {
    if (entry.envelope.sessionId === input.sessionId) {
      await tx.objectStore("outbox").delete(entry.envelope.operationId);
    }
  }
  await tx.done;
  await saveSyncMetadata({
    sessionId: input.sessionId,
    state: "online",
    lastAcknowledgedRevision: input.serverSnapshot.revision,
    updatedAt: Date.now(),
  });
  return archive;
}

export const resolveWithServerVersion = useServerVersion;

export function exportRecoveryArchive<TData>(
  archive: RecoveryArchive<TData>
): string {
  return serializeRecoveryArchive(archive);
}

export async function deleteRecoveryArchive(sessionId: string): Promise<void> {
  await deleteArchiveRecord(sessionId);
}

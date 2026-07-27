import {
  getDeviceId,
  getOfflineDb,
  getSyncMetadata,
  getSnapshot,
  listOutbox,
  putOutboxEntry,
  saveSnapshot,
  saveSyncMetadata,
} from "./db";
import type { CommandEnvelope } from "@/lib/workouts/contracts";
import type { OfflineWorkoutSnapshot, OutboxEntry } from "./models";

export interface EnqueueCommandInput {
  envelope: CommandEnvelope;
  createdAt?: number;
}

function newOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withCanonicalEnvelope(input: EnqueueCommandInput, snapshot?: OfflineWorkoutSnapshot): CommandEnvelope {
  const source = input.envelope;
  return {
    ...source,
    operationId: source.operationId || newOperationId(),
    sessionId: source.sessionId || snapshot?.sessionId || "",
    deviceId: source.deviceId || snapshot?.controllerDeviceId || "",
    controllerEpoch: source.controllerEpoch ?? snapshot?.controllerEpoch ?? 0,
    expectedRevision: source.expectedRevision ?? snapshot?.revision ?? 0,
  };
}

/** Add a canonical command envelope to the durable FIFO. */
export async function enqueueCommand(input: EnqueueCommandInput): Promise<OutboxEntry> {
  const snapshot = await getSnapshot(input.envelope.sessionId);
  const envelope = withCanonicalEnvelope(input, snapshot);
  const existing = await (await getOfflineDb()).get("outbox", envelope.operationId);
  if (existing) return existing as OutboxEntry;

  const existingEntries = await listOutbox(envelope.sessionId);
  const last = existingEntries[existingEntries.length - 1];
  const now = input.createdAt ?? Date.now();
  const entry: OutboxEntry = {
    envelope: { ...envelope, expectedRevision: last ? Math.max(envelope.expectedRevision, last.envelope.expectedRevision + 1) : envelope.expectedRevision },
    operationId: envelope.operationId,
    sessionId: envelope.sessionId,
    controllerEpoch: envelope.controllerEpoch,
    controllerDeviceId: envelope.deviceId,
    expectedRevision: envelope.expectedRevision,
    sequence: last ? last.sequence + 1 : 0,
    createdAt: now,
    attempts: 0,
  };
  await putOutboxEntry(entry);
  const metadata = await getSyncMetadata(envelope.sessionId);
  await saveSyncMetadata({ sessionId: envelope.sessionId, state: "sync-pending", lastAcknowledgedRevision: metadata?.lastAcknowledgedRevision ?? snapshot?.revision ?? 0, updatedAt: now });
  return entry;
}

export const enqueueAction = enqueueCommand;
export const appendOutbox = enqueueCommand;

/** Persist a command and its optimistic snapshot in one IndexedDB transaction. */
export async function enqueueCommandWithSnapshot(
  input: EnqueueCommandInput,
  snapshot: OfflineWorkoutSnapshot,
): Promise<OutboxEntry> {
  const envelope = withCanonicalEnvelope(input, snapshot);
  const db = await getOfflineDb();
  const existing = await db.get("outbox", envelope.operationId);
  if (existing) return existing as OutboxEntry;
  const existingEntries = await listOutbox(envelope.sessionId);
  const last = existingEntries[existingEntries.length - 1];
  const now = input.createdAt ?? Date.now();
  const expectedRevision = last ? Math.max(envelope.expectedRevision, last.envelope.expectedRevision + 1) : envelope.expectedRevision;
  const nextEnvelope = { ...envelope, expectedRevision };
  const entry: OutboxEntry = { envelope: nextEnvelope, operationId: nextEnvelope.operationId, sessionId: nextEnvelope.sessionId, controllerEpoch: nextEnvelope.controllerEpoch, controllerDeviceId: nextEnvelope.deviceId, expectedRevision, sequence: last ? last.sequence + 1 : 0, createdAt: now, attempts: 0 };
  const tx = db.transaction(["outbox", "snapshots"], "readwrite");
  await tx.objectStore("outbox").put(entry);
  await tx.objectStore("snapshots").put({ ...snapshot, updatedAt: snapshot.updatedAt || now });
  await tx.done;
  return entry;
}

export async function saveOptimisticSnapshot<TData>(snapshot: OfflineWorkoutSnapshot<TData>): Promise<void> {
  await saveSnapshot(snapshot);
}

/** Ensure the canonical device field exists before callers build an envelope. */
export { getDeviceId };

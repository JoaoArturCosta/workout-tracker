"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId, getSnapshot, listOutbox, getSyncMetadata, saveSnapshot } from "@/lib/offline-workouts/db";
import { enqueueCommandWithSnapshot } from "@/lib/offline-workouts/outbox";
import { syncOutbox, type CommandSender } from "@/lib/offline-workouts/sync";
import type { CommandEnvelope, WorkoutCommand } from "@/lib/workouts/contracts";
import type { LocalWorkoutStatus, OfflineWorkoutSnapshot, OutboxEntry, SyncState } from "@/lib/offline-workouts/models";

export interface UseActiveWorkoutOptions<TData = unknown> {
  sessionId?: string | null;
  initialSnapshot?: OfflineWorkoutSnapshot<TData> | null;
  sendCommand?: CommandSender<TData>;
  online?: boolean;
  optimisticUpdate?: (snapshot: OfflineWorkoutSnapshot<TData>, command: WorkoutCommand) => OfflineWorkoutSnapshot<TData>;
}

type CommandOf<T extends WorkoutCommand["type"]> = Extract<WorkoutCommand, { type: T }>;

export interface ActiveWorkoutActions {
  queueCommand: (command: WorkoutCommand, options?: { operationId?: string; expectedRevision?: number }) => Promise<OutboxEntry>;
  completeSet: (command: CommandOf<"CompleteSet">) => Promise<OutboxEntry>;
  skipSet: (command: CommandOf<"SkipSet">) => Promise<OutboxEntry>;
  restoreSet: (command: CommandOf<"RestoreSet">) => Promise<OutboxEntry>;
  undoSet: (command: CommandOf<"Undo">) => Promise<OutboxEntry>;
  finish: (command: CommandOf<"Finish">) => Promise<OutboxEntry>;
  end: () => Promise<OutboxEntry>;
  discard: () => Promise<OutboxEntry>;
}

export interface UseActiveWorkoutResult<TData = unknown> {
  snapshot: OfflineWorkoutSnapshot<TData> | null;
  outbox: Array<OutboxEntry>;
  syncState: SyncState;
  isHydrated: boolean;
  isReadOnly: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  setSnapshot: (snapshot: OfflineWorkoutSnapshot<TData>) => Promise<void>;
  actions: ActiveWorkoutActions;
  queueCommand: ActiveWorkoutActions["queueCommand"];
  completeSet: ActiveWorkoutActions["completeSet"];
  skipSet: ActiveWorkoutActions["skipSet"];
  restoreSet: ActiveWorkoutActions["restoreSet"];
  undoSet: ActiveWorkoutActions["undoSet"];
  finish: ActiveWorkoutActions["finish"];
  end: ActiveWorkoutActions["end"];
  discard: ActiveWorkoutActions["discard"];
}

function browserOnline(): boolean { return typeof navigator === "undefined" || navigator.onLine; }

function statusAfterQueue(status: LocalWorkoutStatus, command: WorkoutCommand): LocalWorkoutStatus {
  if (command.type === "Finish") return "Sync-pending";
  if (command.type === "End" || command.type === "Discard") return "Sync-pending";
  return status === "Sync-conflicted" ? status : "Active";
}

function operationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useActiveWorkout<TData = unknown>(options: UseActiveWorkoutOptions<TData>): UseActiveWorkoutResult<TData> {
  const sessionId = options.sessionId ?? null;
  const [snapshot, setSnapshotState] = useState<OfflineWorkoutSnapshot<TData> | null>(options.initialSnapshot ?? null);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(() => (options.online ?? browserOnline()) ? "online" : "offline");
  const [isHydrated, setHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const sendRef = useRef(options.sendCommand);
  sendRef.current = options.sendCommand;
  const optimisticRef = useRef(options.optimisticUpdate);
  optimisticRef.current = options.optimisticUpdate;
  const online = options.online ?? browserOnline();

  const refresh = useCallback(async () => {
    if (!sessionId) { setHydrated(true); return; }
    try {
      const [stored, queued, metadata] = await Promise.all([getSnapshot<TData>(sessionId), listOutbox(sessionId), getSyncMetadata(sessionId)]);
      if (stored) setSnapshotState(stored);
      else if (options.initialSnapshot) { await saveSnapshot(options.initialSnapshot); setSnapshotState(options.initialSnapshot); }
      setOutbox(queued);
      setSyncState(metadata?.state ?? ((options.online ?? browserOnline()) ? "online" : "offline"));
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to read offline workout")); }
    finally { setHydrated(true); }
  }, [options.initialSnapshot, options.online, sessionId]);

  useEffect(() => { setHydrated(false); void refresh(); }, [refresh]);

  const sync = useCallback(async () => {
    if (!sessionId || !sendRef.current || !(options.online ?? browserOnline())) return;
    try {
      const result = await syncOutbox<TData>({ sessionId, send: sendRef.current, onStateChange: setSyncState });
      if (result.snapshot) setSnapshotState(result.snapshot);
      setOutbox(result.remaining);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause : new Error("Unable to sync workout")); setSyncState("sync-conflicted"); setOutbox(await listOutbox(sessionId).catch(() => [])); }
  }, [options.online, sessionId]);

  useEffect(() => { if (isHydrated && online && sendRef.current) void sync(); }, [isHydrated, online, sync]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => { setSyncState("syncing"); void sync(); };
    const handleOffline = () => setSyncState("offline");
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [sync]);

  const setSnapshot = useCallback(async (next: OfflineWorkoutSnapshot<TData>) => { await saveSnapshot(next); setSnapshotState(next); }, []);

  const queueCommand = useCallback(async (command: WorkoutCommand, commandOptions?: { operationId?: string; expectedRevision?: number }): Promise<OutboxEntry> => {
    if (!sessionId) throw new Error("An active workout is required");
    if (!snapshot) throw new Error("Active workout has not loaded");
    if (snapshot.status === "Sync-pending" || snapshot.status === "Sync-conflicted") throw new Error("This workout is read-only until sync resolves");
    const deviceId = snapshot.controllerDeviceId || await getDeviceId();
    const envelope: CommandEnvelope = {
      operationId: commandOptions?.operationId ?? operationId(),
      sessionId,
      deviceId,
      controllerEpoch: snapshot.controllerEpoch,
      expectedRevision: commandOptions?.expectedRevision ?? snapshot.revision,
      command,
    };
    const optimistic = optimisticRef.current ? optimisticRef.current(snapshot, command) : { ...snapshot, status: statusAfterQueue(snapshot.status, command), updatedAt: Date.now() };
    const entry = await enqueueCommandWithSnapshot({ envelope }, optimistic);
    setSnapshotState(optimistic);
    setOutbox((current) => current.some((item) => item.envelope.operationId === entry.envelope.operationId) ? current : [...current, entry].sort((left, right) => left.sequence - right.sequence));
    setSyncState(online ? "sync-pending" : "offline");
    if (online && sendRef.current) void sync();
    return entry;
  }, [online, sessionId, snapshot, sync]);

  const actions = useMemo<ActiveWorkoutActions>(() => ({
    queueCommand,
    completeSet: (command) => queueCommand(command),
    skipSet: (command) => queueCommand(command),
    restoreSet: (command) => queueCommand(command),
    undoSet: (command) => queueCommand(command),
    finish: (command) => queueCommand(command),
    end: () => queueCommand({ type: "End" }),
    discard: () => queueCommand({ type: "Discard" }),
  }), [queueCommand]);

  const isReadOnly = snapshot?.status === "Sync-pending" || snapshot?.status === "Sync-conflicted";
  return { snapshot, outbox, syncState, isHydrated, isReadOnly, error, refresh, sync, setSnapshot, actions, queueCommand: actions.queueCommand, completeSet: actions.completeSet, skipSet: actions.skipSet, restoreSet: actions.restoreSet, undoSet: actions.undoSet, finish: actions.finish, end: actions.end, discard: actions.discard };
}

export default useActiveWorkout;

"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { api } from "@/lib/trpc";
import type { SessionWithExercises } from "@/lib/types";
import type { SetResult } from "@/lib/workouts/contracts";
import { getDeviceId } from "@/lib/offline-workouts/db";
import { applyOptimisticWorkoutCommand } from "@/lib/offline-workouts/optimistic";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import type { OfflineWorkoutSnapshot, OutboxEntry, SyncResponse } from "@/lib/offline-workouts/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutHeader } from "@/components/sessions/workout-header";
import { WorkoutChecklist, type ChecklistExercise } from "@/components/sessions/workout-checklist";
import { WorkoutActions } from "@/components/sessions/workout-actions";
import { RestTimer } from "@/components/sessions/rest-timer";
import { PreviousSessionValues } from "@/components/sessions/previous-session-values";
import { ControllerControls } from "@/components/sessions/controller-controls";
import { SyncConflictDialog } from "@/components/sessions/sync-conflict-dialog";
import { SyncStatus } from "@/components/sessions/sync-status";
import { WorkoutAlertSetup } from "@/components/push/workout-alert-setup";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

interface SessionPageProps { params: Promise<{ sessionId: string }> }
interface ChecklistSelection { exerciseId: string; setId: string }
function resultFromSet(set: SessionWithExercises["occurrences"][number]["sets"][number]): SetResult | null {
  return set.mode === "Duration"
    ? set.actualSeconds == null ? null : { mode: "Duration", externalLoadKg: set.externalLoadKg, actualSeconds: set.actualSeconds, actualReps: null, rpe: set.rpe }
    : set.actualReps == null ? null : { mode: "Reps", externalLoadKg: set.externalLoadKg, actualReps: set.actualReps, actualSeconds: null, rpe: set.rpe };
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params);
  const { data: authSession, status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated" && !!authSession?.user;
  const utils = api.useUtils();
  const query = api.session.getById.useQuery({ sessionId }, { enabled: isAuthenticated });
  const session = query.data as SessionWithExercises | undefined;
  const commandMutation = api.session.command.useMutation({ onError: (error) => toast.error(error.message) });
  const [controllerOpen, setControllerOpen] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void getDeviceId().then((id) => { if (!cancelled) setDeviceId(id); }).catch((error: Error) => toast.error(error.message)); return () => { cancelled = true; }; }, []);
  const controllerQuery = api.device.getControllerState.useQuery({ sessionId, deviceId: deviceId ?? "00000000-0000-0000-0000-000000000000" }, { enabled: isAuthenticated && !!deviceId });
  const handoffMutation = api.device.handoff.useMutation({ onSuccess: () => { toast.success("Controller handed off"); void controllerQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const replaceMutation = api.device.replaceLostDevice.useMutation({ onSuccess: () => { toast.success("This device now controls the workout"); void controllerQuery.refetch(); void query.refetch(); }, onError: (error) => toast.error(error.message) });

  const initialSnapshot = useMemo<OfflineWorkoutSnapshot<SessionWithExercises> | null>(() => session && deviceId ? { sessionId, revision: session.revision, controllerEpoch: session.controllerEpoch, controllerDeviceId: session.controllerDeviceId ?? deviceId, status: session.status, data: session, updatedAt: Date.now() } : null, [deviceId, session, sessionId]);
  const sendQueuedCommand = useCallback(async (entry: OutboxEntry): Promise<SyncResponse<SessionWithExercises>> => {
    const response = await commandMutation.mutateAsync(entry.envelope);
    const refreshed = await query.refetch();
    if (["Finish", "End", "Discard"].includes(entry.envelope.command.type)) {
      await Promise.all([
        utils.session.getCurrent.invalidate(),
        utils.session.getHistory.invalidate(),
      ]);
    }
    const next = refreshed.data as SessionWithExercises | undefined;
    return { revision: response.result.revision, snapshot: next && { sessionId, revision: response.result.revision, controllerEpoch: response.result.controllerEpoch, controllerDeviceId: entry.envelope.deviceId, status: response.result.status, data: next, updatedAt: Date.now() } };
  }, [commandMutation, query, sessionId, utils.session.getCurrent, utils.session.getHistory]);
  const active = useActiveWorkout<SessionWithExercises>({ sessionId, initialSnapshot, sendCommand: sendQueuedCommand, optimisticUpdate: applyOptimisticWorkoutCommand });
  const workout = active.snapshot?.data ?? session;
  const status = active.snapshot?.status ?? workout?.status;
  const readOnly = active.isReadOnly || status !== "Active" || !controllerQuery.data || controllerQuery.data.controllerState === "ReadOnly";
  const exercises = useMemo<ChecklistExercise[]>(() => workout?.occurrences.map((occurrence) => ({ id: occurrence.id, exerciseName: occurrence.exerciseName, mode: occurrence.mode, repsMin: occurrence.repsMin, repsMax: occurrence.repsMax, targetSeconds: occurrence.targetSeconds, sets: occurrence.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, status: set.status, actualReps: set.actualReps, actualSeconds: set.actualSeconds, externalLoadKg: set.externalLoadKg, rpe: set.rpe })) })) ?? [], [workout]);
  const flatSets = useMemo(() => exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set }))), [exercises]);
  const current = flatSets.find(({ set }) => set.status === "Pending");
  const canSkipCurrent = flatSets.filter(({ set }) => set.status === "Pending").length > 1;
  const [selectedSelection, setSelectedSelection] = useState<ChecklistSelection | null>(null);
  const handleChecklistSelection = useCallback((selection: ChecklistSelection) => {
    setSelectedSelection((previous) => previous?.exerciseId === selection.exerciseId && previous.setId === selection.setId ? previous : selection);
  }, []);
  useEffect(() => {
    if (!selectedSelection) return;
    if (!flatSets.some(({ exercise, set }) => exercise.id === selectedSelection.exerciseId && set.id === selectedSelection.setId)) {
      setSelectedSelection(null);
    }
  }, [flatSets, selectedSelection]);
  const selected = selectedSelection ? flatSets.find(({ exercise, set }) => exercise.id === selectedSelection.exerciseId && set.id === selectedSelection.setId) ?? current : current;
  const selectedOccurrence = workout?.occurrences.find((occurrence) => occurrence.id === selected?.exercise.id);
  const priorQueryInput = useMemo(() => ({
    exerciseId: selectedOccurrence?.exerciseId ?? "00000000-0000-0000-0000-000000000000",
    mode: selectedOccurrence?.mode === "Duration" ? "Duration" as const : "Reps" as const,
    setNumber: selected?.set.setNumber ?? 1,
  }), [selected?.set.setNumber, selectedOccurrence?.exerciseId, selectedOccurrence?.mode]);
  const selectedHasResult = selectedOccurrence?.mode === "Duration" ? selected?.set.actualSeconds != null : selected?.set.actualReps != null;
  const priorQueryEnabled = isAuthenticated && !!selectedOccurrence && !!selected && selected?.set.status !== "Completed" && !selectedHasResult;
  const priorQuery = api.session.getPriorSetValues.useQuery(priorQueryInput, { enabled: priorQueryEnabled });
  const allSets = flatSets.length;
  const completedSets = flatSets.filter(({ set }) => set.status === "Completed").length;
  const rest = workout?.rest;

  if (authStatus === "loading") return <div className="container mx-auto p-6">Loading…</div>;
  if (!isAuthenticated) return <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6"><Card className="max-w-md"><CardContent className="space-y-4 pt-6 text-center"><LogIn className="mx-auto" /><h2 className="text-xl font-semibold">Sign in required</h2><p className="text-sm text-muted-foreground">Sign in to view this workout.</p><Button onClick={() => signIn()}>Sign in</Button></CardContent></Card></div>;
  if (!workout) return <div className="container mx-auto p-6"><p>Loading workout…</p></div>;

  const completeSet = (setId: string, result: SetResult) => {
    const finalSet = flatSets.filter(({ set }) => set.status === "Pending").length === 1;
    if (finalSet && !window.confirm("Finish this workout?")) return;
    if (finalSet) return active.finish({ type: "Finish", sessionSetId: setId, result });
    return active.completeSet({ type: "CompleteSet", sessionSetId: setId, result });
  };
  const finishWorkout = () => { const last = [...flatSets].reverse().find(({ set }) => set.status === "Completed"); const source = last && workout.occurrences.flatMap((occurrence) => occurrence.sets).find((set) => set.id === last.set.id); const result = source && resultFromSet(source); if (source && result) void active.finish({ type: "Finish", sessionSetId: source.id, result }); };
  return <main className="container mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <WorkoutHeader name={workout.templateName} status={status ?? workout.status} completedSets={completedSets} totalSets={allSets} startedAt={String(workout.startTime)} />
    <SyncStatus state={active.syncState} pendingCount={active.outbox.length} errorMessage={active.error?.message} />
    {!readOnly && deviceId && <WorkoutAlertSetup deviceId={deviceId} />}
    <WorkoutActions onDeviceControl={deviceId ? () => setControllerOpen(true) : undefined} canUndo={!readOnly && completedSets > 0} canFinish={!readOnly && completedSets === allSets && allSets > 0} onUndo={readOnly ? undefined : () => { const last = [...flatSets].reverse().find(({ set }) => set.status === "Completed"); if (last) void active.undoSet({ type: "Undo", sessionSetId: last.set.id }); }} onFinish={readOnly ? undefined : finishWorkout} onEnd={readOnly ? undefined : () => void active.end()} onDiscard={readOnly ? undefined : () => void active.discard()} />
    {deviceId && <ControllerControls open={controllerOpen} onOpenChange={setControllerOpen} hideTrigger controllerState={controllerQuery.data?.controllerState ?? "ReadOnly"} controllerDeviceId={controllerQuery.data?.controllerDeviceId ?? workout.controllerDeviceId} controllerEpoch={controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch} acknowledgedRevision={controllerQuery.data?.revision ?? workout.revision} pendingOperationCount={active.outbox.length} disabled={handoffMutation.isPending || replaceMutation.isPending} onHandoff={(nextDeviceId) => handoffMutation.mutate({ sessionId, currentDeviceId: deviceId, nextDeviceId, controllerEpoch: controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch, acknowledgedRevision: controllerQuery.data?.revision ?? workout.revision, pendingOperationCount: active.outbox.length })} onReplaceLostDevice={() => { if (window.confirm("Replace the lost controller? Unsynced changes may be lost.")) replaceMutation.mutate({ sessionId, nextDeviceId: deviceId, controllerEpoch: controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch, confirmUnsyncedDataLoss: true }); }} />}
    {rest && !readOnly && <RestTimer startedAt={rest.startedAt} dueAt={rest.dueAt} onSkip={() => void active.queueCommand({ type: "SkipRest" })} />}
    <Card><CardHeader><CardTitle>Exercises</CardTitle></CardHeader><CardContent><WorkoutChecklist exercises={exercises} prior={priorQuery.data} priorSelection={selected ? { exerciseId: selected.exercise.id, setId: selected.set.id } : null} readOnly={readOnly} onSelectionChange={handleChecklistSelection} onSkipSet={!readOnly && canSkipCurrent ? (setId) => void active.skipSet({ type: "SkipSet", sessionSetId: setId }) : undefined} onSaveSet={(setId, result) => { const source = flatSets.find(({ set }) => set.id === setId); if (!source || readOnly) return; const normalized: SetResult = source.exercise.mode === "Duration" ? { mode: "Duration", externalLoadKg: result.externalLoadKg, actualSeconds: result.actualSeconds ?? 1, actualReps: null, rpe: result.rpe } : { mode: "Reps", externalLoadKg: result.externalLoadKg, actualReps: result.actualReps ?? 1, actualSeconds: null, rpe: result.rpe }; if (source.set.status === "Pending" && source.set.id === current?.set.id) { void completeSet(setId, normalized); } else { void active.queueCommand({ type: "SaveSet", sessionSetId: setId, result: normalized }); } }} /></CardContent></Card>
    {selectedOccurrence && selected && <PreviousSessionValues exerciseId={selectedOccurrence.exerciseId} mode={selectedOccurrence.mode} setNumber={selected.set.setNumber} prior={priorQuery.data ?? null} />}
    {active.syncState === "sync-conflicted" && active.snapshot && initialSnapshot && <SyncConflictDialog sessionId={sessionId} snapshot={active.snapshot} serverSnapshot={initialSnapshot} onResolved={async () => { await active.refresh(); await query.refetch(); }} />}
  </main>;
}

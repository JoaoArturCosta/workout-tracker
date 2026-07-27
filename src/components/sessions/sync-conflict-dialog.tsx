"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createRecoveryArchive, exportRecoveryArchive, useServerVersion as applyServerVersion } from "@/lib/offline-workouts/recovery";
import type { OfflineWorkoutSnapshot } from "@/lib/offline-workouts/models";

interface SyncConflictDialogProps<TData> {
  sessionId: string;
  snapshot: OfflineWorkoutSnapshot<TData> | null;
  serverSnapshot: OfflineWorkoutSnapshot<TData>;
  onResolved: () => Promise<void>;
}

export function SyncConflictDialog<TData>({ sessionId, snapshot, serverSnapshot, onResolved }: SyncConflictDialogProps<TData>) {
  const [busy, setBusy] = useState(false);
  const resolve = async (action: () => Promise<void>) => { setBusy(true); try { await action(); await onResolved(); } finally { setBusy(false); } };
  return <Card className="border-destructive" data-testid="sync-conflict-dialog"><CardHeader><CardTitle>Sync conflict</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">The server rejected an offline change. Review or export the local copy before using the server version.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void resolve(async () => { const archive = await createRecoveryArchive({ sessionId, snapshot, reason: "sync-conflict" }); const text = exportRecoveryArchive(archive); const blob = new Blob([text], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `workout-recovery-${sessionId}.json`; link.click(); URL.revokeObjectURL(url); })}>Export local copy</Button><Button disabled={busy} onClick={() => void resolve(async () => { await applyServerVersion({ sessionId, snapshot, serverSnapshot, reason: "use-server-version" }); })}>Use server version</Button></div></CardContent></Card>;
}

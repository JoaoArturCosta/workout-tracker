"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ControllerControlsProps {
  controllerState: "Controlling" | "ReadOnly";
  controllerDeviceId: string | null;
  controllerEpoch: number;
  acknowledgedRevision: number;
  pendingOperationCount: number;
  onHandoff: (nextDeviceId: string) => void;
  onReplaceLostDevice: () => void;
  disabled?: boolean;
}

export function ControllerControls({ controllerState, controllerDeviceId, controllerEpoch, acknowledgedRevision, pendingOperationCount, onHandoff, onReplaceLostDevice, disabled = false }: ControllerControlsProps) {
  const [nextDeviceId, setNextDeviceId] = useState("");
  const controlling = controllerState === "Controlling";
  return <div className="space-y-3 rounded-lg border p-3" data-testid="controller-controls">
    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">Device control</span><Badge variant={controlling ? "default" : "secondary"}>{controllerState}</Badge></div>
    {controlling ? <div className="flex gap-2"><Input value={nextDeviceId} onChange={(event) => setNextDeviceId(event.target.value)} placeholder="Next device UUID" aria-label="Next device UUID" /><Button variant="outline" disabled={disabled || !nextDeviceId} onClick={() => { onHandoff(nextDeviceId); setNextDeviceId(""); }}>Hand off</Button></div> : <div className="space-y-2"><p className="text-xs text-muted-foreground">This workout is controlled by another device{controllerDeviceId ? ` (${controllerDeviceId})` : ""}. Changes stay read-only here.</p><Button variant="destructive" disabled={disabled} onClick={onReplaceLostDevice}>Replace lost device</Button></div>}
    <p className="text-xs text-muted-foreground">Controller epoch {controllerEpoch} · revision {acknowledgedRevision} · {pendingOperationCount} pending changes</p>
  </div>;
}

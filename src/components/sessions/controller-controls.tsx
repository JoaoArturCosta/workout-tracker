"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ControllerControlsProps {
  controllerState: "Controlling" | "ReadOnly";
  controllerDeviceId: string | null;
  controllerEpoch: number;
  acknowledgedRevision: number;
  pendingOperationCount: number;
  onHandoff: (nextDeviceId: string) => void;
  onReplaceLostDevice: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  disabled?: boolean;
}

export function ControllerControls({ controllerState, controllerDeviceId, controllerEpoch, acknowledgedRevision, pendingOperationCount, onHandoff, onReplaceLostDevice, open, onOpenChange, hideTrigger = false, disabled = false }: ControllerControlsProps) {
  const [nextDeviceId, setNextDeviceId] = useState("");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlling = controllerState === "Controlling";
  const dialogOpen = open ?? uncontrolledOpen;
  const setDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger && <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="controller-controls-trigger">
          <Settings2 data-icon="inline-start" />
          Device control
        </Button>
      </DialogTrigger>}
      <DialogContent data-testid="controller-controls">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Device control</DialogTitle>
            <Badge variant={controlling ? "default" : "secondary"}>{controllerState}</Badge>
          </div>
          <DialogDescription>
            {controlling
              ? "Hand off this workout to another device."
              : "This workout is controlled by another device. Changes stay read-only here."}
          </DialogDescription>
        </DialogHeader>
        {controlling ? (
          <div className="flex gap-2">
            <Input value={nextDeviceId} onChange={(event) => setNextDeviceId(event.target.value)} placeholder="Next device UUID" aria-label="Next device UUID" />
            <Button variant="outline" disabled={disabled || !nextDeviceId} onClick={() => { onHandoff(nextDeviceId); setNextDeviceId(""); }}>Hand off</Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {controllerDeviceId && <p className="text-xs text-muted-foreground">Controller device: {controllerDeviceId}</p>}
            <Button variant="destructive" disabled={disabled} onClick={onReplaceLostDevice}>Replace lost device</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Controller epoch {controllerEpoch} · revision {acknowledgedRevision} · {pendingOperationCount} pending changes</p>
      </DialogContent>
    </Dialog>
  );
}

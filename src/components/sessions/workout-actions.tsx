"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WorkoutActionsProps {
  canUndo?: boolean;
  canRestore?: boolean;
  canFinish?: boolean;
  disabled?: boolean;
  onRestore?: () => void;
  onUndo?: () => void;
  onSkipRest?: () => void;
  onFinish?: () => void;
  onEnd?: () => void;
  onDiscard?: () => void;
  onDeviceControl?: () => void;
}

const confirmAction = (message: string, action?: () => void) => {
  if (action && window.confirm(message)) action();
};

export function WorkoutActions({ canUndo = false, canRestore = false, canFinish = false, disabled = false, onRestore, onUndo, onSkipRest, onFinish, onEnd, onDiscard, onDeviceControl }: WorkoutActionsProps) {
  const hasWorkoutOptions = Boolean(onDeviceControl || onEnd || onDiscard);

  return (
    <div className="flex flex-wrap gap-2" data-testid="workout-actions">
      {canRestore && onRestore && <Button variant="outline" onClick={onRestore} disabled={disabled}>Restore set</Button>}
      {canUndo && onUndo && <Button variant="outline" onClick={onUndo} disabled={disabled}>Undo last completion</Button>}
      {onSkipRest && <Button variant="outline" onClick={onSkipRest} disabled={disabled}>Skip rest</Button>}
      {canFinish && onFinish && <Button onClick={() => confirmAction("Finish this workout?", onFinish)} disabled={disabled}>Finish</Button>}
      {hasWorkoutOptions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Workout options" disabled={disabled}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onDeviceControl && <DropdownMenuItem onSelect={onDeviceControl} disabled={disabled}>Device control</DropdownMenuItem>}
            {onEnd && (
              <DropdownMenuItem onSelect={() => confirmAction("End this workout early? Completed sets will stay in history.", onEnd)} disabled={disabled}>
                End early
              </DropdownMenuItem>
            )}
            {onDiscard && (
              <DropdownMenuItem variant="destructive" onSelect={() => confirmAction("Discard this workout? Its results will not count.", onDiscard)} disabled={disabled}>
                Discard
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

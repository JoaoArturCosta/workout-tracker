"use client";

import { Button } from "@/components/ui/button";

export interface WorkoutActionsProps {
  canUndo?: boolean;
  canRestore?: boolean;
  canSkip?: boolean;
  canFinish?: boolean;
  disabled?: boolean;
  onSkip?: () => void;
  onRestore?: () => void;
  onUndo?: () => void;
  onSkipRest?: () => void;
  onFinish?: () => void;
  onEnd?: () => void;
  onDiscard?: () => void;
}

const confirmAction = (message: string, action?: () => void) => {
  if (action && window.confirm(message)) action();
};

export function WorkoutActions({ canUndo = false, canRestore = false, canSkip = false, canFinish = false, disabled = false, onSkip, onRestore, onUndo, onSkipRest, onFinish, onEnd, onDiscard }: WorkoutActionsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="workout-actions">
      {canSkip && onSkip && <Button variant="outline" onClick={() => confirmAction("Skip this set?", onSkip)} disabled={disabled}>Skip set</Button>}
      {canRestore && onRestore && <Button variant="outline" onClick={onRestore} disabled={disabled}>Restore set</Button>}
      {canUndo && onUndo && <Button variant="outline" onClick={onUndo} disabled={disabled}>Undo last completion</Button>}
      {onSkipRest && <Button variant="outline" onClick={onSkipRest} disabled={disabled}>Skip rest</Button>}
      {canFinish && onFinish && <Button onClick={() => confirmAction("Finish this workout?", onFinish)} disabled={disabled}>Finish</Button>}
      {onEnd && <Button variant="outline" onClick={() => confirmAction("End this workout early? Completed sets will stay in history.", onEnd)} disabled={disabled}>End early</Button>}
      {onDiscard && <Button variant="destructive" onClick={() => confirmAction("Discard this workout? Its results will not count.", onDiscard)} disabled={disabled}>Discard</Button>}
    </div>
  );
}

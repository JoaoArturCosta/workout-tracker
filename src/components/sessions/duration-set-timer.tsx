"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatSeconds, secondsRemaining } from "@/lib/workouts/time";

export interface DurationSetTimerProps {
  targetSeconds: number;
  startedAt?: Date | string | null;
  onStart?: (startedAt: string) => void;
  onStop?: (actualSeconds: number) => void;
  disabled?: boolean;
}

/** A foreground duration timer. It never completes a set by itself. */
export function DurationSetTimer({
  targetSeconds,
  startedAt,
  onStart,
  onStop,
  disabled = false,
}: DurationSetTimerProps) {
  const [started, setStarted] = useState<Date | null>(() =>
    startedAt ? new Date(startedAt) : null
  );
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0
  );

  useEffect(() => {
    if (!started) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [started]);

  const handleStart = () => {
    const now = new Date();
    setStarted(now);
    setElapsed(0);
    onStart?.(now.toISOString());
  };

  const handleStop = () => {
    onStop?.(Math.max(1, elapsed));
    setStarted(null);
  };

  if (!started) {
    return (
      <Button type="button" variant="outline" onClick={handleStart} disabled={disabled}>
        Start duration ({formatSeconds(targetSeconds)})
      </Button>
    );
  }

  const remaining = secondsRemaining(new Date(started.getTime() + targetSeconds * 1000));
  return (
    <div className="flex items-center gap-3" data-testid="duration-timer">
      <div className="text-sm" aria-live="polite">
        <span className="font-semibold">{formatSeconds(elapsed)}</span>
        <span className="text-muted-foreground"> / {formatSeconds(targetSeconds)}</span>
        {remaining === 0 && <span className="ml-2 text-amber-700">Target reached</span>}
      </div>
      <Button type="button" onClick={handleStop} disabled={disabled}>
        Save duration
      </Button>
    </div>
  );
}

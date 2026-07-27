"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatSeconds, secondsRemaining } from "@/lib/workouts/time";

export interface RestTimerProps {
  startedAt: Date | string;
  dueAt: Date | string;
  onSkip?: () => void;
  onFinished?: () => void;
  readOnly?: boolean;
}

export function RestTimer({
  startedAt,
  dueAt,
  onSkip,
  onFinished,
  readOnly = false,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(dueAt));
  const finishedRef = useRef(false);

  useEffect(() => {
    const update = () => setRemaining(secondsRemaining(dueAt));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [dueAt]);

  useEffect(() => {
    if (remaining > 0) finishedRef.current = false;
    if (remaining === 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinished?.();
    }
  }, [remaining, onFinished]);

  return (
    <Card className="border-blue-200 bg-blue-50" data-testid="rest-timer">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">Rest period</p>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {remaining > 0 ? `${formatSeconds(remaining)} remaining` : "Rest finished"}
            </p>
            <span className="sr-only">Started {new Date(startedAt).toLocaleTimeString()}</span>
          </div>
        </div>
        {!readOnly && onSkip && (
          <Button variant="outline" onClick={onSkip}>
            Skip rest
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

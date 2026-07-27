"use client";

import { Clock, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionTimer } from "@/components/sessions/session-timer";

export type WorkoutStatus = "Active" | "Completed" | "Partial" | "Discarded" | string;

export interface WorkoutHeaderProps {
  name: string;
  status: WorkoutStatus;
  completedSets: number;
  totalSets: number;
  startedAt?: Date | string | null;
}

export function WorkoutHeader({
  name,
  status,
  completedSets,
  totalSets,
  startedAt,
}: WorkoutHeaderProps) {
  const ended = status !== "Active";
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="workout-header">
      <div>
        <h1 className="text-2xl font-bold">{name}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Target className="h-4 w-4" />{completedSets}/{totalSets} sets</span>
          {startedAt && !ended && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /><SessionTimer startTime={String(startedAt)} /></span>}
          <Badge variant={status === "Completed" ? "default" : status === "Partial" ? "secondary" : status === "Discarded" ? "destructive" : "outline"}>{status}</Badge>
        </div>
      </div>
    </header>
  );
}

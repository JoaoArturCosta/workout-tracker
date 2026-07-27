"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/trpc";
import type { PriorSetValues } from "@/lib/types";

interface PreviousSessionValuesProps {
  exerciseId: string;
  mode?: "Reps" | "Duration" | string;
  setNumber?: number;
  prior?: PriorSetValues | null;
}

export function PreviousSessionValues({ exerciseId, mode, setNumber = 1, prior }: PreviousSessionValuesProps) {
  const normalizedMode = mode === "Duration" ? "Duration" : "Reps";
  const { data: queriedPrior } = api.session.getPriorSetValues.useQuery({ exerciseId, mode: normalizedMode, setNumber }, { enabled: prior === undefined });
  const values = prior === undefined ? queriedPrior : prior;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-4 w-4" />Prior set values</CardTitle></CardHeader>
      <CardContent>
        {!values ? <p className="py-4 text-center text-sm text-muted-foreground">No prior completed set matches.</p> : (
          <div className="flex items-center justify-between text-sm">
            <div><p className="font-medium">Set {setNumber}</p><p className="text-xs text-muted-foreground">{values.externalLoadKg} kg · {normalizedMode === "Duration" ? `${values.actualSeconds ?? "—"} sec` : `${values.actualReps ?? "—"} reps`}{values.rpe != null ? ` · RPE ${values.rpe}` : ""}</p></div>
            <Badge variant="secondary">Most recent</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/trpc";

interface PreviousSessionValuesProps {
  exerciseId: string;
  mode?: "Reps" | "Duration" | string;
  setNumber?: number;
}

export function PreviousSessionValues({ exerciseId, mode, setNumber = 1 }: PreviousSessionValuesProps) {
  const normalizedMode = mode === "Duration" ? "Duration" : "Reps";
  const { data: prior } = api.session.getPriorSetValues.useQuery({ exerciseId, mode: normalizedMode, setNumber });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="h-4 w-4" />Prior set values</CardTitle></CardHeader>
      <CardContent>
        {!prior ? <p className="py-4 text-center text-sm text-muted-foreground">No prior completed set matches.</p> : (
          <div className="flex items-center justify-between text-sm">
            <div><p className="font-medium">Set {setNumber}</p><p className="text-xs text-muted-foreground">{prior.externalLoadKg} kg · {normalizedMode === "Duration" ? `${prior.actualSeconds ?? "—"} sec` : `${prior.actualReps ?? "—"} reps`}</p></div>
            <Badge variant="secondary">Most recent</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

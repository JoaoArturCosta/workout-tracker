import Link from "next/link";
import { ArrowRight, Clock, Dumbbell } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export interface SessionHistoryCardProps {
  id: string;
  name: string;
  startTime: Date | string | null;
  status: "Completed" | "Partial";
  totalVolume: number;
  durationSetCount: number;
  totalActualSeconds: number;
}

export function SessionHistoryCard({
  id,
  name,
  startTime,
  status,
  totalVolume,
  durationSetCount,
  totalActualSeconds,
}: SessionHistoryCardProps) {
  return (
    <Link
      href={`/sessions/${id}`}
      aria-label={`View ${name} session details`}
      className="group block rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {startTime ? new Date(startTime).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === "Completed" ? "default" : "secondary"}>
            {status}
          </Badge>
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1">
          <Dumbbell className="h-3 w-3" />
          {totalVolume} kg Reps volume
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {durationSetCount} Duration sets · {totalActualSeconds}s
        </span>
      </div>
    </Link>
  );
}

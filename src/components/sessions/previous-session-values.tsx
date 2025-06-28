"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, TrendingUp } from "lucide-react";
import { api } from "@/lib/trpc";

interface PreviousSessionValuesProps {
  exerciseId: string;
}

export function PreviousSessionValues({
  exerciseId,
}: PreviousSessionValuesProps) {
  const { data: previousSessions } =
    api.session.getPreviousSessionValues.useQuery({
      exerciseId,
      limit: 3,
    });

  if (!previousSessions || previousSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-4 w-4" />
            Previous Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No previous data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-4 w-4" />
          Previous Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {previousSessions.map((session, index) => (
          <div
            key={session.date}
            className="border-b last:border-b-0 pb-3 last:pb-0"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {formatDate(session.date)}
                </span>
                {index === 0 && (
                  <Badge variant="secondary" className="text-xs">
                    Most Recent
                  </Badge>
                )}
              </div>
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            </div>

            <div className="space-y-1">
              {session.sets.map((set: any, setIndex: number) => (
                <div
                  key={setIndex}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>Set {set.setNumber || setIndex + 1}</span>
                  <span>
                    {set.weight}kg × {set.reps} reps
                    {set.rpe && ` @ RPE ${set.rpe}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

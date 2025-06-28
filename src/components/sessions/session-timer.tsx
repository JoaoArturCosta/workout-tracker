"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface SessionTimerProps {
  startTime: string;
}

export function SessionTimer({ startTime }: SessionTimerProps) {
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const updateDuration = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (hours > 0) {
        setDuration(
          `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
      } else {
        setDuration(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md text-blue-700">
      <Clock className="h-4 w-4" />
      <span className="font-mono text-sm font-medium">{duration}</span>
    </div>
  );
}

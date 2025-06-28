import { Loader2, Dumbbell } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative">
            <Dumbbell className="h-12 w-12 text-primary" />
            <Loader2 className="h-6 w-6 text-primary/60 animate-spin absolute -top-1 -right-1" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Loading Workout Tracker</h2>
          <p className="text-muted-foreground text-sm">
            Preparing your fitness journey...
          </p>
        </div>
        <div className="w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
          <div
            className="h-full bg-primary rounded-full animate-pulse"
            style={{
              animationDuration: "1.5s",
              width: "60%",
            }}
          />
        </div>
      </div>
    </div>
  );
}

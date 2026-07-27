import { BellOff } from "lucide-react";

export function ForegroundOnlyWarning() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950"
    >
      <BellOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Foreground-only alerts</p>
        <p className="text-sm">
          Keep this app open for rest alerts. You can set up background alerts
          at any time.
        </p>
      </div>
    </div>
  );
}

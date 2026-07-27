import { and, asc, eq, gte } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  deliveryEvents,
  restPeriods,
  workoutSessions,
} from "@/lib/db/schema";
import {
  computePresentationSli,
  type DeliveryEvent,
  type DeliveryEventType,
} from "./telemetry";

const DELIVERY_EVENT_TYPES = new Set<DeliveryEventType>([
  "Due",
  "CallbackReceived",
  "PushAccepted",
  "PushRejected",
  "WorkerReceived",
  "ShowResolved",
  "ShowFailed",
  "AckReceived",
  "Tap",
]);

export async function getRestAlertDiagnostics(
  db: Database,
  userId: string,
  now = new Date()
) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      alertId: deliveryEvents.restPeriodId,
      type: deliveryEvents.eventType,
      occurredAt: deliveryEvents.occurredAt,
    })
    .from(deliveryEvents)
    .innerJoin(
      restPeriods,
      eq(deliveryEvents.restPeriodId, restPeriods.id)
    )
    .innerJoin(
      workoutSessions,
      eq(restPeriods.sessionId, workoutSessions.id)
    )
    .where(
      and(
        eq(workoutSessions.userId, userId),
        gte(deliveryEvents.occurredAt, since)
      )
    )
    .orderBy(asc(deliveryEvents.occurredAt));

  const events: DeliveryEvent[] = rows.flatMap((row) =>
    row.alertId && isDeliveryEventType(row.type)
      ? [
          {
            alertId: row.alertId,
            type: row.type,
            occurredAt: row.occurredAt,
          },
        ]
      : []
  );
  return {
    windowStartedAt: since,
    windowEndedAt: now,
    presentation: computePresentationSli(events, now),
    recentEvents: events.slice(-100),
  };
}

function isDeliveryEventType(value: string): value is DeliveryEventType {
  return DELIVERY_EVENT_TYPES.has(value as DeliveryEventType);
}

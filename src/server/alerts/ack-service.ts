import { and, eq } from "drizzle-orm";

import type { Database } from "@/lib/db";
import {
  deliveryEvents,
  readinessAttempts,
  restPeriods,
} from "@/lib/db/schema";
import type { PushAck } from "./contracts";
import { createReadinessRepository } from "./readiness-db";
import { createReadinessService } from "./readiness-service";

export async function acceptWorkerAck(
  db: Database,
  ack: PushAck,
  receivedAt = new Date()
): Promise<boolean> {
  if (ack.attemptNonce) {
    const [attempt] = await db
      .select({
        id: readinessAttempts.id,
        subscriptionId: readinessAttempts.subscriptionId,
      })
      .from(readinessAttempts)
      .where(
        and(
          eq(readinessAttempts.id, ack.alertId),
          eq(readinessAttempts.nonce, ack.attemptNonce)
        )
      )
      .limit(1);
    if (!attempt) {
      return false;
    }

    await db.insert(deliveryEvents).values({
      readinessAttemptId: attempt.id,
      subscriptionId: attempt.subscriptionId,
      eventType: ack.event,
      occurredAt: receivedAt,
      detail: { workerReportedAt: ack.occurredAt },
    });
    await db.insert(deliveryEvents).values({
      readinessAttemptId: attempt.id,
      subscriptionId: attempt.subscriptionId,
      eventType: "AckReceived",
      occurredAt: receivedAt,
      detail: { acknowledgedEvent: ack.event },
    });

    if (ack.event === "ShowResolved") {
      const readiness = createReadinessService({
        repository: createReadinessRepository(db),
        createId: crypto.randomUUID,
        createNonce: crypto.randomUUID,
        sendTestPush: async () => ({ status: "rejected" }),
      });
      return readiness.acknowledge({
        alertId: ack.alertId,
        nonce: ack.attemptNonce,
        occurredAt: receivedAt,
      });
    }
    return true;
  }

  const [rest] = await db
    .select({ id: restPeriods.id })
    .from(restPeriods)
    .where(eq(restPeriods.id, ack.alertId))
    .limit(1);
  if (!rest) {
    return false;
  }
  await db.insert(deliveryEvents).values({
    restPeriodId: rest.id,
    eventType: ack.event,
    occurredAt: receivedAt,
    detail: { workerReportedAt: ack.occurredAt },
  });
  await db.insert(deliveryEvents).values({
    restPeriodId: rest.id,
    eventType: "AckReceived",
    occurredAt: receivedAt,
    detail: { acknowledgedEvent: ack.event },
  });
  return true;
}

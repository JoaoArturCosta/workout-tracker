export type DeliveryEventType =
  | "Due"
  | "CallbackReceived"
  | "PushAccepted"
  | "PushRejected"
  | "WorkerReceived"
  | "ShowResolved"
  | "ShowFailed"
  | "AckReceived"
  | "Tap";

export interface DeliveryEvent {
  alertId: string;
  type: DeliveryEventType;
  occurredAt: Date;
}

export interface PresentationSli {
  eligible: number;
  presentedWithinTenSeconds: number;
  failed: number;
  rate: number;
  label: "Presentation accepted";
}

export function computePresentationSli(
  events: readonly DeliveryEvent[],
  now: Date
): PresentationSli {
  const byAlert = new Map<string, DeliveryEvent[]>();
  for (const event of events) {
    const alertEvents = byAlert.get(event.alertId) ?? [];
    alertEvents.push(event);
    byAlert.set(event.alertId, alertEvents);
  }

  let eligible = 0;
  let presentedWithinTenSeconds = 0;

  for (const alertEvents of byAlert.values()) {
    const due = earliest(alertEvents, "Due");
    if (!due || now.getTime() - due.occurredAt.getTime() < 10_000) {
      continue;
    }

    eligible += 1;
    const shown = earliest(alertEvents, "ShowResolved");
    if (
      shown &&
      shown.occurredAt.getTime() >= due.occurredAt.getTime() &&
      shown.occurredAt.getTime() - due.occurredAt.getTime() <= 10_000
    ) {
      presentedWithinTenSeconds += 1;
    }
  }

  return {
    eligible,
    presentedWithinTenSeconds,
    failed: eligible - presentedWithinTenSeconds,
    rate: eligible === 0 ? 0 : presentedWithinTenSeconds / eligible,
    label: "Presentation accepted",
  };
}

function earliest(
  events: readonly DeliveryEvent[],
  type: DeliveryEventType
): DeliveryEvent | undefined {
  return events
    .filter((event) => event.type === type)
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0];
}

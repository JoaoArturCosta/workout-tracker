type WorkerAckEvent =
  | "WorkerReceived"
  | "ShowResolved"
  | "ShowFailed"
  | "Tap";

interface BasePayload {
  version: 1;
  alertId: string;
  deepLink: string;
}

interface ReadinessPayload extends BasePayload {
  kind: "readiness-test";
  attemptNonce: string;
}

interface RestPayload extends BasePayload {
  kind: "rest-finished";
  sessionId: string;
  currentSetId: string;
  dueAt: string;
  exerciseLabel: string;
  setPosition: string;
  target:
    | { mode: "Reps"; repsMin: number; repsMax: number }
    | { mode: "Duration"; targetSeconds: number };
}

export type WorkerPushPayload = ReadinessPayload | RestPayload;

interface NotificationData {
  alertId: string;
  attemptNonce?: string;
  deepLink: string;
}

export interface WorkerClient {
  url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}

export interface WorkerRuntime {
  showNotification(
    title: string,
    options: {
      body: string;
      tag: string;
      icon: string;
      badge: string;
      data: NotificationData;
    }
  ): Promise<void>;
  postAck(input: {
    alertId: string;
    attemptNonce?: string;
    event: WorkerAckEvent;
    occurredAt: string;
  }): Promise<void>;
  matchClients(): Promise<readonly WorkerClient[]>;
  openWindow(url: string): Promise<unknown>;
}

export async function handlePushPayload(
  payload: WorkerPushPayload,
  runtime: WorkerRuntime
): Promise<void> {
  await ignoreAckFailure(
    runtime.postAck({
      alertId: payload.alertId,
      ...(payload.kind === "readiness-test"
        ? { attemptNonce: payload.attemptNonce }
        : {}),
      event: "WorkerReceived",
      occurredAt: new Date().toISOString(),
    })
  );

  const view =
    payload.kind === "readiness-test"
      ? {
          title: "Alerts are ready",
          body: "Background rest alerts are set up on this device.",
          tag: `ready-${payload.alertId}`,
        }
      : {
          title: "Rest finished",
          body: formatRestBody(payload),
          tag: `rest-${payload.alertId}`,
        };
  const data: NotificationData = {
    alertId: payload.alertId,
    ...(payload.kind === "readiness-test"
      ? { attemptNonce: payload.attemptNonce }
      : {}),
    deepLink: payload.deepLink,
  };

  try {
    await runtime.showNotification(view.title, {
      body: view.body,
      tag: view.tag,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      data,
    });
    await ignoreAckFailure(
      runtime.postAck({
        alertId: payload.alertId,
        ...(payload.kind === "readiness-test"
          ? { attemptNonce: payload.attemptNonce }
          : {}),
        event: "ShowResolved",
        occurredAt: new Date().toISOString(),
      })
    );
  } catch {
    await ignoreAckFailure(
      runtime.postAck({
        alertId: payload.alertId,
        ...(payload.kind === "readiness-test"
          ? { attemptNonce: payload.attemptNonce }
          : {}),
        event: "ShowFailed",
        occurredAt: new Date().toISOString(),
      })
    );
  }
}

export async function handleNotificationClick(
  data: NotificationData,
  runtime: WorkerRuntime
): Promise<void> {
  const clients = await runtime.matchClients();
  const client = clients[0];
  if (client) {
    await client.navigate?.(data.deepLink);
    await client.focus();
  } else {
    await runtime.openWindow(data.deepLink);
  }

  await ignoreAckFailure(
    runtime.postAck({
      alertId: data.alertId,
      ...(data.attemptNonce ? { attemptNonce: data.attemptNonce } : {}),
      event: "Tap",
      occurredAt: new Date().toISOString(),
    })
  );
}

function formatRestBody(payload: RestPayload): string {
  const target =
    payload.target.mode === "Reps"
      ? `${payload.target.repsMin}–${payload.target.repsMax} reps`
      : `${payload.target.targetSeconds} seconds`;
  return `${payload.exerciseLabel} · ${payload.setPosition} · ${target}`;
}

async function ignoreAckFailure(ack: Promise<void>): Promise<void> {
  try {
    await ack;
  } catch {
    // The notification has already reached its terminal display state.
  }
}

interface WorkerEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface PushEventLike extends WorkerEvent {
  data?: { json(): unknown };
}

interface NotificationClickEventLike extends WorkerEvent {
  notification: {
    data?: NotificationData;
    close(): void;
  };
}

interface ServiceWorkerRuntime {
  registration: {
    showNotification(
      title: string,
      options: NotificationOptions
    ): Promise<void>;
  };
  clients: {
    matchAll(options: {
      type: "window";
      includeUncontrolled: true;
    }): Promise<readonly WorkerClient[]>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(
    type: "push" | "notificationclick",
    listener: (event: never) => void
  ): void;
}

const workerScope = globalThis as unknown as Partial<ServiceWorkerRuntime>;

if (workerScope.registration && workerScope.clients) {
  const runtime: WorkerRuntime = {
    showNotification: (title, options) =>
      workerScope.registration!.showNotification(title, options),
    postAck: async (input) => {
      await fetch("/api/push/ack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    matchClients: () =>
      workerScope.clients!.matchAll({
        type: "window",
        includeUncontrolled: true,
      }),
    openWindow: (url) => workerScope.clients!.openWindow(url),
  };

  workerScope.addEventListener?.("push", ((event: PushEventLike) => {
    if (!event.data) {
      return;
    }
    const payload = event.data.json();
    if (!isWorkerPushPayload(payload)) {
      return;
    }
    event.waitUntil(handlePushPayload(payload, runtime));
  }) as never);

  workerScope.addEventListener?.(
    "notificationclick",
    ((event: NotificationClickEventLike) => {
      event.notification.close();
      const data = event.notification.data;
      if (!data) {
        return;
      }
      event.waitUntil(handleNotificationClick(data, runtime));
    }) as never
  );
}

function isWorkerPushPayload(value: unknown): value is WorkerPushPayload {
  if (!isRecord(value) || value.version !== 1) {
    return false;
  }
  if (
    typeof value.alertId !== "string" ||
    typeof value.deepLink !== "string" ||
    !value.deepLink.startsWith("/") ||
    value.deepLink.startsWith("//")
  ) {
    return false;
  }
  if (value.kind === "readiness-test") {
    return typeof value.attemptNonce === "string";
  }
  return (
    value.kind === "rest-finished" &&
    typeof value.sessionId === "string" &&
    typeof value.currentSetId === "string" &&
    typeof value.dueAt === "string" &&
    typeof value.exerciseLabel === "string" &&
    typeof value.setPosition === "string" &&
    isRecord(value.target) &&
    (value.target.mode === "Reps" || value.target.mode === "Duration")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

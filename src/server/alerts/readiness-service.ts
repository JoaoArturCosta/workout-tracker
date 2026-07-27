import type { ReadinessPushPayload } from "./contracts";

const READINESS_WINDOW_MS = 15_000;

export type ReadinessAttemptStatus =
  | "Pending"
  | "Dispatched"
  | "Passed"
  | "Failed";

export interface ReadinessAttempt {
  id: string;
  userId: string;
  deviceId: string;
  subscriptionId: string;
  nonce: string;
  status: ReadinessAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
}

export interface ReadinessRepository {
  createAttempt(attempt: ReadinessAttempt): Promise<void>;
  markDispatched(
    attemptId: string,
    dispatchedAt: Date,
    expiresAt: Date
  ): Promise<boolean>;
  acceptPresentationAck(input: {
    attemptId: string;
    nonce: string;
    occurredAt: Date;
  }): Promise<boolean>;
  failAttempt(attemptId: string, reason: string): Promise<void>;
  getAttemptStatus(input: {
    userId: string;
    attemptId: string;
  }): Promise<ReadinessAttemptStatus | null>;
}

interface ReadinessDependencies {
  repository: ReadinessRepository;
  sendTestPush(
    input: ReadinessPushPayload
  ): Promise<{ status: "accepted" | "expired" | "rejected" }>;
  createNonce(): string;
  createId(): string;
}

export function createReadinessService(dependencies: ReadinessDependencies) {
  return {
    async start(input: {
      userId: string;
      deviceId: string;
      subscriptionId: string;
      now?: Date;
    }): Promise<ReadinessAttempt> {
      const startedAt = input.now ?? new Date();
      const attempt: ReadinessAttempt = {
        id: dependencies.createId(),
        userId: input.userId,
        deviceId: input.deviceId,
        subscriptionId: input.subscriptionId,
        nonce: dependencies.createNonce(),
        status: "Pending",
        startedAt,
        expiresAt: new Date(startedAt.getTime() + READINESS_WINDOW_MS),
      };

      await dependencies.repository.createAttempt(attempt);
      const dispatchedAt = input.now ?? new Date();
      const expiresAt = new Date(
        dispatchedAt.getTime() + READINESS_WINDOW_MS
      );
      const markedDispatched =
        await dependencies.repository.markDispatched(
          attempt.id,
          dispatchedAt,
          expiresAt
        );
      if (!markedDispatched) {
        await dependencies.repository.failAttempt(
          attempt.id,
          "DispatchStateFailed"
        );
        return { ...attempt, status: "Failed" };
      }

      const result = await dependencies.sendTestPush({
        version: 1,
        kind: "readiness-test",
        alertId: attempt.id,
        attemptNonce: attempt.nonce,
        deepLink: "/sessions",
      });

      if (result.status !== "accepted") {
        await dependencies.repository.failAttempt(
          attempt.id,
          result.status === "expired"
            ? "SubscriptionExpired"
            : "PushRejected"
        );
        return { ...attempt, status: "Failed" };
      }

      return { ...attempt, expiresAt, status: "Dispatched" };
    },

    acknowledge(input: {
      alertId: string;
      nonce: string;
      occurredAt?: Date;
    }): Promise<boolean> {
      return dependencies.repository.acceptPresentationAck({
        attemptId: input.alertId,
        nonce: input.nonce,
        occurredAt: input.occurredAt ?? new Date(),
      });
    },

    getStatus(input: { userId: string; attemptId: string }) {
      return dependencies.repository.getAttemptStatus(input);
    },
  };
}

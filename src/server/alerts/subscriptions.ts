export interface ReplaceSubscriptionInput {
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  installed: boolean;
  workerVersion: string;
}

export interface SubscriptionRepository {
  replace(input: ReplaceSubscriptionInput): Promise<{
    id: string;
    ready: boolean;
  }>;
  revokeOwned(
    userId: string,
    subscriptionId: string,
    now: Date
  ): Promise<boolean>;
  revoke(subscriptionId: string, now: Date): Promise<boolean>;
  getStatus(input: {
    userId: string;
    deviceId: string;
  }): Promise<{
    subscriptionId: string | null;
    installed: boolean;
    backgroundAlertReady: boolean;
  }>;
}

export function createSubscriptionService(
  repository: SubscriptionRepository
) {
  return {
    async replace(input: ReplaceSubscriptionInput) {
      const saved = await repository.replace(input);
      return {
        subscriptionId: saved.id,
        backgroundAlertReady: saved.ready,
      };
    },

    unsubscribe(
      userId: string,
      subscriptionId: string,
      now = new Date()
    ) {
      return repository.revokeOwned(userId, subscriptionId, now);
    },

    pruneExpired(subscriptionId: string, now = new Date()) {
      return repository.revoke(subscriptionId, now);
    },

    getStatus(input: { userId: string; deviceId: string }) {
      return repository.getStatus(input);
    },
  };
}

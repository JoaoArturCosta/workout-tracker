"use client";

import { useEffect } from "react";

import { api, trpcClient } from "@/lib/trpc";
import { AlertSetupCard, type AlertSetupState } from "./alert-setup-card";
import { ForegroundOnlyWarning } from "./foreground-only-warning";
import { fingerprintWorker } from "./worker-fingerprint";

interface WorkoutAlertSetupProps {
  deviceId: string;
  showWarning?: boolean;
}

export function WorkoutAlertSetup({
  deviceId,
  showWarning = true,
}: WorkoutAlertSetupProps) {
  const status = api.device.pushStatus.useQuery({ deviceId });
  const register = api.device.register.useMutation();
  const replace = api.device.replacePushSubscription.useMutation();
  const unsubscribe = api.device.unsubscribePush.useMutation();
  const startTest = api.device.startReadinessTest.useMutation();
  const backgroundAlertReady = status.data?.backgroundAlertReady ?? false;
  const activeSubscriptionId = status.data?.subscriptionId ?? null;
  const replaceSubscription = replace.mutateAsync;
  const unsubscribePush = unsubscribe.mutateAsync;
  const refetchStatus = status.refetch;

  useEffect(() => {
    if (
      !backgroundAlertReady ||
      !activeSubscriptionId ||
      typeof window === "undefined"
    ) {
      return;
    }

    let cancelled = false;
    const validate = async () => {
      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration()
          : undefined;
      const subscription =
        await registration?.pushManager.getSubscription();
      if (
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !isStandalone() ||
        !registration ||
        !subscription
      ) {
        await unsubscribePush({
          subscriptionId: activeSubscriptionId,
        });
        if (!cancelled) await refetchStatus();
        return;
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        await unsubscribePush({
          subscriptionId: activeSubscriptionId,
        });
        if (!cancelled) await refetchStatus();
        return;
      }
      const refreshed = await replaceSubscription({
        deviceId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        installed: true,
        workerVersion: await fingerprintWorker(registration),
      });
      if (!cancelled && !refreshed.backgroundAlertReady) {
        await refetchStatus();
      }
    };
    void validate();
    return () => {
      cancelled = true;
    };
  }, [
    activeSubscriptionId,
    backgroundAlertReady,
    deviceId,
    refetchStatus,
    replaceSubscription,
    unsubscribePush,
  ]);

  if (status.isLoading) {
    return null;
  }

  const publicVapidKey = status.data?.publicVapidKey;
  if (!publicVapidKey) {
    return showWarning ? <ForegroundOnlyWarning /> : null;
  }

  const state: AlertSetupState = status.data?.backgroundAlertReady
    ? "Ready"
    : !isStandalone()
      ? "NeedsInstall"
      : "NeedsSetup";

  return (
    <div className="space-y-3">
      <AlertSetupCard
        state={state}
        publicVapidKey={publicVapidKey}
        onSaveSubscription={async (subscription) => {
          await register.mutateAsync({ deviceId });
          const saved = await replace.mutateAsync({
            deviceId,
            ...subscription,
          });
          return { subscriptionId: saved.subscriptionId };
        }}
        onRunReadiness={async (subscriptionId) => {
          const attempt = await startTest.mutateAsync({
            deviceId,
            subscriptionId,
          });
          if (attempt.status === "Failed") {
            return "Failed";
          }

          const expiresAt = new Date(attempt.expiresAt).getTime();
          while (Date.now() <= expiresAt) {
            const result =
              await trpcClient.device.readinessTestStatus.query({
                attemptId: attempt.attemptId,
              });
            if (result.status === "Passed") {
              await status.refetch();
              return "Ready";
            }
            if (result.status === "Failed") {
              return "Failed";
            }
            await wait(500);
          }
          return "Failed";
        }}
        onSkip={() => undefined}
      />
      {showWarning && state !== "Ready" && <ForegroundOnlyWarning />}
    </div>
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

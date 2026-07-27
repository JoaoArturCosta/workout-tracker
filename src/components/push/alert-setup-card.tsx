"use client";

import { useState } from "react";
import { Bell, BellRing, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fingerprintWorker } from "./worker-fingerprint";

export type AlertSetupState = "NeedsInstall" | "NeedsSetup" | "Ready";

interface AlertSetupCardProps {
  state: AlertSetupState;
  publicVapidKey: string;
  onSaveSubscription(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    installed: boolean;
    workerVersion: string;
  }): Promise<{ subscriptionId: string }>;
  onRunReadiness(subscriptionId: string): Promise<"Ready" | "Failed">;
  onSkip(): void;
}

export function AlertSetupCard({
  state,
  publicVapidKey,
  onSaveSubscription,
  onRunReadiness,
  onSkip,
}: AlertSetupCardProps) {
  const [localState, setLocalState] = useState(state);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string>();

  if (localState === "Ready") {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardContent className="flex items-center gap-3 p-4 text-green-950">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <div>
            <p className="font-medium">Background-alert ready</p>
            <p className="text-sm">
              This device passed its alert display test.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const runSetup = async () => {
    setIsWorking(true);
    setError(undefined);
    try {
      const subscription = await subscribeToPush(publicVapidKey);
      const saved = await onSaveSubscription({
        ...subscription,
        installed: isStandalone(),
      });
      const result = await onRunReadiness(saved.subscriptionId);
      if (result !== "Ready") {
        throw new Error("The test alert was not shown within 15 seconds.");
      }
      setLocalState("Ready");
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Background alert setup failed."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const skip = () => {
    onSkip();
    setError("Keep this app open for rest alerts.");
  };

  return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5" aria-hidden="true" />
            Get rest-finished alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {localState === "NeedsInstall" ? (
            <p className="text-sm">
              Install this app first. On iPhone, open the Share menu and choose
              Add to Home Screen. On Android, use the browser&apos;s Install app
              action. Then reopen the installed app.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Grant notification access, save this device, and show one test
              alert. The test must finish within 15 seconds.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {localState !== "NeedsInstall" && (
              <Button onClick={runSetup} disabled={isWorking}>
                {isWorking ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isWorking ? "Testing alert…" : "Set up alerts"}
              </Button>
            )}
            <Button variant="ghost" onClick={skip} disabled={isWorking}>
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
  );
}

async function subscribeToPush(publicVapidKey: string): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
  workerVersion: string;
}> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    throw new Error("This browser does not support background alerts.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification access was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicVapidKey),
    }));
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  return {
    endpoint: json.endpoint,
    p256dh,
    auth,
    workerVersion: await fingerprintWorker(registration),
  };
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
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

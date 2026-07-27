import { Client, Receiver } from "@upstash/qstash";
import webPush from "web-push";

import { env } from "@/env.mjs";
import { createRestAlertPublisher } from "./qstash";
import { createWebPushSender } from "./web-push";

interface AlertEnvironment {
  qstashToken: string;
  currentSigningKey: string;
  nextSigningKey: string;
  publicVapidKey: string;
  privateVapidKey: string;
  vapidSubject: string;
  appUrl: string;
}

export function readAlertEnvironment(): AlertEnvironment {
  return {
    qstashToken: requireValue("QSTASH_TOKEN", env.QSTASH_TOKEN),
    currentSigningKey: requireValue(
      "QSTASH_CURRENT_SIGNING_KEY",
      env.QSTASH_CURRENT_SIGNING_KEY
    ),
    nextSigningKey: requireValue(
      "QSTASH_NEXT_SIGNING_KEY",
      env.QSTASH_NEXT_SIGNING_KEY
    ),
    publicVapidKey: requireValue(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    ),
    privateVapidKey: requireValue(
      "VAPID_PRIVATE_KEY",
      env.VAPID_PRIVATE_KEY
    ),
    vapidSubject: requireValue("VAPID_SUBJECT", env.VAPID_SUBJECT),
    appUrl: requireValue("APP_URL", env.APP_URL),
  };
}

export function isAlertEnvironmentConfigured(): boolean {
  return [
    env.QSTASH_TOKEN,
    env.QSTASH_CURRENT_SIGNING_KEY,
    env.QSTASH_NEXT_SIGNING_KEY,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
    env.VAPID_SUBJECT,
    env.APP_URL,
  ].every(Boolean);
}

export function createAlertRuntime() {
  const config = readAlertEnvironment();
  const qstash = new Client({ token: config.qstashToken });
  const receiver = new Receiver({
    currentSigningKey: config.currentSigningKey,
    nextSigningKey: config.nextSigningKey,
  });

  return {
    publicVapidKey: config.publicVapidKey,
    appUrl: config.appUrl,
    restPublisher: createRestAlertPublisher(
      {
        publishJSON: async (request) => {
          const result = await qstash.publishJSON(request);
          if (!("messageId" in result)) {
            throw new Error("QStash returned no message ID");
          }
          return { messageId: result.messageId };
        },
      },
      { canonicalAppUrl: config.appUrl }
    ),
    pushSender: createWebPushSender(webPush, {
      subject: config.vapidSubject,
      publicKey: config.publicVapidKey,
      privateKey: config.privateVapidKey,
    }),
    verifyQStash(input: { body: string; signature: string; url: string }) {
      return receiver.verify(input);
    },
  };
}

function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required for background alerts`);
  }
  return value;
}

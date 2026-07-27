import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { createRestDispatchRepository } from "@/server/alerts/dispatch-db";
import { verifyDispatchRequest } from "@/server/alerts/dispatch-request";
import { createRestAlertDispatcher } from "@/server/alerts/dispatch-service";
import { createAlertRuntime } from "@/server/alerts/runtime";

export const runtime = "nodejs";

const dispatchBodySchema = z
  .object({
    restId: z.string().uuid(),
    token: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.text();
  const alerts = createAlertRuntime();
  const canonicalUrl = new URL(
    "/api/rest-alerts/dispatch",
    alerts.appUrl
  ).toString();
  const verified = await verifyDispatchRequest(
    body,
    request.headers.get("upstash-signature"),
    canonicalUrl,
    alerts.verifyQStash
  );
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = dispatchBodySchema.safeParse(value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid dispatch payload" },
      { status: 400 }
    );
  }

  const dispatcher = createRestAlertDispatcher({
    repository: createRestDispatchRepository(db),
    send: alerts.pushSender.send,
  });
  const result = await dispatcher.dispatch(parsed.data);
  if (result.status === "rejected") {
    return NextResponse.json(
      { error: "Push provider rejected the alert" },
      { status: 503 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { acceptWorkerAck } from "@/server/alerts/ack-service";
import { pushAckSchema } from "@/server/alerts/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = pushAckSchema.safeParse(value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid acknowledgement" }, { status: 400 });
  }

  await acceptWorkerAck(db, parsed.data);
  return new NextResponse(null, { status: 204 });
}

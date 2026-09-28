import { NextResponse } from "next/server";
import { dispatchDueReminders } from "@/lib/tasks/dispatch";

/**
 * Little Things — the scheduled half of reminder delivery.
 *
 * Reminders normally go out when either of you opens the app (see the authed
 * layout). This endpoint covers the quiet days when neither of you does. It is
 * safe to call as often as you like: each reminder is claimed before it's sent,
 * so nothing goes out twice.
 *
 * Guarded by CRON_SECRET (Vercel Cron sends it as `Authorization: Bearer …`).
 * Without the secret set, the endpoint doesn't exist — in-app reminders are
 * unaffected.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("Not found", { status: 404 });

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sent = await dispatchDueReminders();
  return NextResponse.json({ ok: true, sent });
}

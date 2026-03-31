import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct subscription is disabled. Use /api/stripe/create-checkout to subscribe via Stripe.",
    },
    { status: 410 }
  );
}

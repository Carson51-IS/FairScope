import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ active: false });
    }

    const status = await getSubscriptionStatus(user.id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ active: false });
  }
}

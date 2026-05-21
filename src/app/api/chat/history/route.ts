import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessChatHistory, getAccessStatus } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getAccessStatus(user.id);
    if (!canAccessChatHistory(access)) {
      return NextResponse.json(
        { error: "Subscribe or use a free chat message to unlock history" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (err) {
    console.error("[chat/history]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load history" },
      { status: 500 }
    );
  }
}

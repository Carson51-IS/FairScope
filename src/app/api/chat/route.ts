import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import { getOpenAI, isOpenAIConfigured, logTokenUsage } from "@/lib/openai";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 20;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getSubscriptionStatus(user.id);
    if (!status.active) {
      return NextResponse.json(
        { error: "Active subscription required" },
        { status: 403 }
      );
    }

    if (!isOpenAIConfigured()) {
      return NextResponse.json(
        { error: "Chat not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const analysisContext = typeof body?.analysisContext === "string" ? body.analysisContext.trim() : "";
    if (!message) {
      return NextResponse.json(
        { error: "Message required" },
        { status: 400 }
      );
    }

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const reversed = (history ?? []).reverse();
    let systemContent = `You are a legal research assistant specializing in U.S. copyright fair use (17 U.S.C. § 107). You help users understand fair use, the four statutory factors, and how courts have applied them. You have access to this user's prior questions and can reference them (e.g., "Based on your earlier question about parody...") to provide continuity. Be accurate, cite cases when relevant, and remind users this is not legal advice.`;
    if (analysisContext) {
      systemContent += `\n\nThe user is asking questions about their specific FairScope analysis. Here is the full analysis for context:\n\n${analysisContext}\n\nWhen answering, reference their specific factors, strengths, weaknesses, and case citations. Help them understand what parts of the analysis mean for their proposed use.`;
    }

    const messages: { role: "user" | "assistant" | "system"; content: string }[] = [
      { role: "system", content: systemContent },
      ...reversed.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 1000,
      messages,
    });

    logTokenUsage("chat", response.usage);

    const assistantContent = response.choices[0]?.message?.content ?? "";

    await supabase.from("chat_messages").insert([
      { user_id: user.id, role: "user", content: message },
      { user_id: user.id, role: "assistant", content: assistantContent },
    ]);

    return NextResponse.json({ message: assistantContent });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}

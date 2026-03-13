"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

function buildAnalysisContext(result: AnalysisResult): string {
  const parts: string[] = [];
  parts.push("## User's Fair Use Analysis Result\n");
  parts.push("### Fact Summary\n" + result.fact_summary);
  if (result.assumptions?.length) {
    parts.push("\n### Assumptions\n" + result.assumptions.join("\n"));
  }
  if (result.ambiguities?.length) {
    parts.push("\n### Ambiguities\n" + result.ambiguities.join("\n"));
  }
  parts.push("\n### Factor Analysis");
  for (const f of result.factor_scores) {
    parts.push(
      `\n**Factor ${f.factor_number}: ${f.factor_name}** — ${f.direction}\n${f.reasoning}`
    );
  }
  parts.push("\n### Overall Assessment");
  parts.push("Strengths: " + result.overall_assessment.strengths.join("; "));
  parts.push("Weaknesses: " + result.overall_assessment.weaknesses.join("; "));
  parts.push("Litigation risks: " + result.overall_assessment.litigation_risks.join("; "));
  if (result.memo) {
    parts.push("\n### AI Memo\n" + result.memo);
  }
  return parts.join("\n");
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ResultChatProps {
  result: AnalysisResult;
}

export default function ResultChat({ result }: ResultChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const analysisContext = buildAnalysisContext(result);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((d) => setSubscribed(!!d.active))
      .catch(() => setSubscribed(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, analysisContext }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(text);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: `temp-${Date.now()}-a`,
        role: "assistant",
        content: data.message,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  if (subscribed === null) return null;
  if (!subscribed) return null;

  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 overflow-hidden">
      <div className="px-5 py-4 bg-navy-50/30 border-b border-navy-100">
        <h2 className="font-display text-lg font-bold text-navy-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-gold-600" />
          Ask questions about this analysis
        </h2>
        <p className="text-navy-600 text-sm mt-1">
          Not sure what something means? Ask about any factor, case, or part of the result.
        </p>
      </div>

      <div className="flex flex-col max-h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[120px]">
          {messages.length === 0 && (
            <p className="text-navy-500 text-sm">
              e.g. &quot;What does Factor 2 mean for my use?&quot; or &quot;Why did the analysis cite Andy Warhol?&quot;
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  m.role === "user"
                    ? "bg-gold-500 text-navy-950"
                    : "bg-navy-100 text-navy-800"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-navy-100 rounded-lg px-4 py-2">
                <span className="text-navy-500 text-sm">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-navy-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this analysis..."
              className="flex-1 px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900 text-sm"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-3 rounded-lg bg-gold-500 hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-950 font-semibold transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

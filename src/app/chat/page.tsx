"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Paywall from "@/components/Paywall";
import { Send, MessageCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statusRes, historyRes] = await Promise.all([
          fetch("/api/subscription/status"),
          fetch("/api/chat/history"),
        ]);

        const status = await statusRes.json();
        setSubscribed(!!status.active);

        if (status.active && historyRes.ok) {
          const { messages: msgs } = await historyRes.json();
          setMessages(msgs ?? []);
        }
      } catch {
        setSubscribed(false);
      } finally {
        setLoading(false);
      }
    }
    load();
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
        body: JSON.stringify({ message: text }),
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-gold-500" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!subscribed) {
    return (
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <main className="flex-1 flex items-center justify-center p-8">
          <Paywall />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Header />

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <MessageCircle className="w-6 h-6 text-gold-600" />
          <h1 className="font-display text-2xl font-bold text-navy-900">
            Fair Use Chat
          </h1>
        </div>
        <p className="text-navy-600 text-sm mb-6">
          Ask questions about fair use. I remember our conversation and can reference earlier questions.
        </p>

        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-navy-200 shadow-md overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-navy-500 text-sm text-center py-8">
                Start a conversation. Ask about parody, transformative use, the four factors, or any fair use question.
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
                placeholder="Ask about fair use..."
                className="flex-1 px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900"
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
      </main>

      <Footer />
    </div>
  );
}

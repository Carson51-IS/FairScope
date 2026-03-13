"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Settings, CreditCard, Trash2, LogOut } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState<{
    active: boolean;
    status?: string;
    currentPeriodEnd?: string;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        setSubStatus(data);
      } catch {
        setSubStatus({ active: false });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCancelSubscription = async () => {
    if (!confirm("Cancel your subscription? You will lose access at the end of the current period.")) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (res.ok) {
        const res2 = await fetch("/api/subscription/status");
        const data = await res2.json();
        setSubStatus(data);
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/subscription/subscribe", { method: "POST" });
      if (res.ok) {
        const res2 = await fetch("/api/subscription/status");
        const data = await res2.json();
        setSubStatus(data);
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm("Clear all chat history? This cannot be undone.")) return;
    setClearLoading(true);
    try {
      await fetch("/api/chat/clear", { method: "POST" });
      setClearLoading(false);
    } catch {
      setClearLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
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

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <Settings className="w-6 h-6 text-gold-600" />
          <h1 className="font-display text-2xl font-bold text-navy-900">
            Settings
          </h1>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-navy-200 shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-gold-600" />
              <h2 className="font-semibold text-navy-900">Subscription</h2>
            </div>

            {subStatus?.active ? (
              <div>
                <p className="text-emerald-700 text-sm font-medium mb-2">
                  Pro plan active
                </p>
                {subStatus.currentPeriodEnd && (
                  <p className="text-navy-600 text-xs mb-4">
                    Renews {new Date(subStatus.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={handleCancelSubscription}
                  disabled={portalLoading}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                >
                  {portalLoading ? "Canceling..." : "Cancel subscription"}
                </button>
                <p className="text-navy-500 text-xs mt-2">
                  Cancel to stop access at the end of your billing period.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-navy-600 text-sm mb-4">
                  Subscribe to access analysis and chat.
                </p>
                <button
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 text-navy-950 font-semibold disabled:opacity-50"
                >
                  {checkoutLoading ? "Subscribing..." : "Subscribe for $1/month"}
                </button>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-navy-200 shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="w-5 h-5 text-gold-600" />
              <h2 className="font-semibold text-navy-900">Chat memory</h2>
            </div>
            <p className="text-navy-600 text-sm mb-4">
              Clear your chat history. The AI will no longer reference past conversations.
            </p>
            <button
              onClick={handleClearChat}
              disabled={clearLoading || !subStatus?.active}
              className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearLoading ? "Clearing..." : "Clear chat history"}
            </button>
          </section>

          <section className="bg-white rounded-xl border border-navy-200 shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <LogOut className="w-5 h-5 text-gold-600" />
              <h2 className="font-semibold text-navy-900">Account</h2>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 text-sm font-medium"
            >
              Log out
            </button>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

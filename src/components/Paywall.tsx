"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

export default function Paywall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscription/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to subscribe");
        setLoading(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-xl border border-navy-200 shadow-md p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-gold-100 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-gold-600" />
      </div>
      <h2 className="font-display text-xl font-bold text-navy-900 mb-2">
        Subscribe to FairScope Pro
      </h2>
      <p className="text-navy-600 text-sm mb-6">
        Get full access to AI-powered fair use analysis and chat for $1/month.
        No free tier — pay once, use whenever you need.
      </p>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-950 font-semibold transition-colors"
      >
        {loading ? "Subscribing..." : "Subscribe for $1/month"}
      </button>
    </div>
  );
}

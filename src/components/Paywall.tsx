"use client";

import { useState } from "react";
import { Lock, CreditCard, Check, Zap } from "lucide-react";

export default function Paywall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/create-checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to start checkout");
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No checkout URL returned");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl border border-navy-200 shadow-xl shadow-navy-900/10 overflow-hidden">
        <div className="bg-gradient-to-br from-navy-900 to-navy-950 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold-500/30">
            <Lock className="w-8 h-8 text-navy-950" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white mb-2">
            FairScope Pro
          </h2>
          <p className="text-navy-300 text-sm">
            Unlock full access to AI-powered fair use analysis
          </p>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-navy-900">$1</span>
              <span className="text-navy-500 text-sm">/month</span>
            </div>
            <p className="text-navy-500 text-xs mt-1">Cancel anytime</p>
          </div>

          <ul className="space-y-3 mb-8">
            {[
              "Unlimited fair use analyses",
              "AI-powered legal research chat",
              "Factor-by-factor case law citations",
              "Precedent status tracking",
              "Full analysis export",
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-navy-700 text-sm">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-950 font-semibold text-base transition-all shadow-md hover:shadow-lg"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Redirecting to checkout...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Subscribe Now
              </>
            )}
          </button>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-navy-400">
            <Zap className="w-3.5 h-3.5" />
            <span>Secure payment via Stripe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

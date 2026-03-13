"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScenarioForm from "@/components/ScenarioForm";
import Paywall from "@/components/Paywall";
import type { ScenarioInput, AnalysisResult } from "@/lib/types";

export default function AnalyzePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then((d) => setSubscribed(!!d.active))
      .catch(() => setSubscribed(false));
  }, []);

  const handleSubmit = async (scenario: ScenarioInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Analysis failed");
      }

      const result: AnalysisResult = await response.json();

      sessionStorage.setItem(
        `fairscope-result-${result.id}`,
        JSON.stringify(result)
      );

      router.push(`/results/${result.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setIsLoading(false);
    }
  };

  if (subscribed === null) {
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

      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-3">
              Analyze Your Proposed Use
            </h1>
            <p className="text-navy-600 text-lg max-w-2xl mx-auto">
              Describe the copyrighted work and how you plan to use it.
              FairScope will apply the four-factor &sect; 107 analysis using
              federal case law.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          <ScenarioForm onSubmit={handleSubmit} isLoading={isLoading} />

          <div className="mt-8 text-center text-xs text-navy-500">
            <p>
              FairScope analyzes U.S. federal fair use law only (17 U.S.C.
              &sect; 107). This is not legal advice.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

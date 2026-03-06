"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FactorCard from "@/components/FactorCard";
import FactorTable from "@/components/FactorTable";
import PrecedentStatus from "@/components/PrecedentStatus";
import Disclaimer from "@/components/Disclaimer";
import type { AnalysisResult } from "@/lib/types";
import {
  ArrowLeft,
  Clock,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  Target,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Search,
  Calendar,
  MapPin,
  ShoppingCart,
} from "lucide-react";

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles = {
    high: "bg-emerald-100 text-emerald-800 border-emerald-200",
    moderate: "bg-amber-100 text-amber-800 border-amber-200",
    low: "bg-red-100 text-red-800 border-red-200",
  }[confidence] ?? "bg-navy-100 text-navy-700 border-navy-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${styles}`}
    >
      <Target className="w-4 h-4" />
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Retrieval
      Confidence
    </span>
  );
}

function CollapsiblePanel({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-navy-50/30 hover:bg-navy-50 text-navy-800 font-semibold text-left transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gold-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gold-600" />
        )}
      </button>
      {open && <div className="p-5 border-t border-navy-100">{children}</div>}
    </div>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResult() {
      // Try loading from DB first
      try {
        const res = await fetch(`/api/analysis/${id}`);
        if (res.ok) {
          const data = await res.json();
          setResult(data);
          setLoading(false);
          return;
        }
      } catch {
        // DB unavailable, fall through to sessionStorage
      }

      // Fall back to sessionStorage
      const stored = sessionStorage.getItem(`fairscope-result-${id}`);
      if (stored) {
        setResult(JSON.parse(stored));
      }
      setLoading(false);
    }

    loadResult();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-gold-500 mx-auto mb-4" />
            <p className="text-navy-600">Loading analysis...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-navy-900 mb-2">
              Analysis Not Found
            </h2>
            <p className="text-navy-600 mb-6">
              This analysis may have expired from your session. Please run a new
              analysis.
            </p>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              New Analysis
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <Link
                href="/analyze"
                className="text-navy-500 hover:text-navy-700 text-sm flex items-center gap-1 mb-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                New Analysis
              </Link>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">
                FairScope Analysis
              </h1>
              <p className="text-navy-500 text-sm mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Based on federal cases through {result.date_cutoff}
              </p>
            </div>
            <ConfidenceBadge confidence={result.confidence} />
          </div>

          {/* I. Fact Summary */}
          <section className="mb-8">
            <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 p-6">
              <h2 className="font-display text-xl font-bold text-navy-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold-600" />
                I. Restatement of Facts
              </h2>
              <p className="text-navy-700 leading-relaxed text-sm">
                {result.fact_summary}
              </p>

              {result.assumptions && result.assumptions.length > 0 && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" />
                    What We Assumed Based on Your Description
                  </h3>
                  <p className="text-blue-700 text-xs mb-3">
                    We read your description carefully and filled in some details. Check these to make sure they match your situation.
                  </p>
                  <ul className="space-y-2">
                    {result.assumptions.map((a, i) => (
                      <li
                        key={i}
                        className="text-blue-800 text-sm flex gap-2"
                      >
                        <span className="text-blue-500 mt-0.5">&bull;</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ambiguities.length > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Noted Ambiguities
                  </h3>
                  <ul className="space-y-2">
                    {result.ambiguities.map((a, i) => (
                      <li
                        key={i}
                        className="text-amber-800 text-sm flex gap-2"
                      >
                        <span className="text-amber-500 mt-0.5">&bull;</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* II-V. Factor Analysis Cards */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
              Factor Analysis
            </h2>
            <div className="space-y-6">
              {result.factor_scores.map((factor) => (
                <FactorCard
                  key={factor.factor_number}
                  factorNumber={factor.factor_number}
                  factorName={factor.factor_name}
                  direction={factor.direction}
                  weight={factor.weight}
                  reasoning={factor.reasoning}
                  keyCases={factor.key_cases}
                  keyQuotes={factor.key_quotes}
                  governingPrinciples={factor.governing_principles}
                  comparisonToFacts={factor.comparison_to_facts}
                />
              ))}
            </div>
          </section>

          {/* VI. Factor Weight Table */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
              VI. Factor Weight Summary
            </h2>
            <FactorTable factors={result.factor_scores} />
          </section>

          {/* LLM Analysis Memo (if available) */}
          {result.memo && (
            <section className="mb-8">
              <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
                AI-Enhanced Analysis Memo
              </h2>
              <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 p-6">
                <div className="prose prose-sm prose-navy max-w-none">
                  {result.memo.split("\n").map((paragraph, i) =>
                    paragraph.trim() ? (
                      <p key={i} className="text-navy-700 leading-relaxed mb-3">
                        {paragraph}
                      </p>
                    ) : null
                  )}
                </div>
                {result.cited_cases && result.cited_cases.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-navy-100">
                    <p className="text-xs text-navy-500">
                      Cited cases: {result.cited_cases.join(", ")}
                    </p>
                  </div>
                )}
                {result.analysis_source && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-navy-100 text-navy-600">
                      Source: {result.analysis_source} | Retrieval: {result.retrieval_source ?? "local"}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Circuit Conflicts Warning */}
          {result.circuit_conflicts && result.circuit_conflicts.length > 0 && (
            <section className="mb-8">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Circuit Conflict Detected
                </h3>
                {result.circuit_conflicts.map((c, i) => (
                  <p key={i} className="text-purple-800 text-sm leading-relaxed">
                    {c}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Market Substitution Analysis (Factor 4 Deep Dive) */}
          {result.market_substitution && (
            <section className="mb-8">
              <CollapsiblePanel
                title="Market Substitution Analysis (Factor 4 Deep Dive)"
                icon={<ShoppingCart className="w-5 h-5 text-gold-600" />}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Licensing Substitute",
                        value: result.market_substitution.is_licensing_substitute,
                      },
                      {
                        label: "Same Audience",
                        value: result.market_substitution.same_audience,
                      },
                      {
                        label: "Same Format",
                        value: result.market_substitution.same_format,
                      },
                      {
                        label: "Channel Overlap",
                        value: result.market_substitution.commercial_channel_overlap,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-lg p-3 text-center border ${
                          item.value
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                        }`}
                      >
                        <div className="text-xs font-medium mb-1">
                          {item.label}
                        </div>
                        <div className="text-sm font-bold">
                          {item.value ? "Yes" : "No"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-navy-700 text-sm leading-relaxed">
                    {result.market_substitution.reasoning}
                  </p>
                  <p className="text-navy-500 text-xs italic">
                    After Andy Warhol Foundation v. Goldsmith (2023), commercial licensing
                    market substitution weighs heavily against fair use even when the new work
                    adds new meaning.
                  </p>
                </div>
              </CollapsiblePanel>
            </section>
          )}

          {/* Similarity Transparency Panel */}
          {result.retrieved_passages && result.retrieved_passages.length > 0 && (
            <section className="mb-8">
              <CollapsiblePanel
                title="Retrieval Transparency — Why These Cases?"
                icon={<Search className="w-5 h-5 text-gold-600" />}
              >
                <p className="text-navy-600 text-xs mb-4">
                  These are the passages retrieved from the case corpus via vector similarity search.
                  Higher similarity scores indicate closer semantic match to your scenario.
                </p>
                <div className="space-y-3">
                  {result.retrieved_passages.map((p, i) => (
                    <div
                      key={i}
                      className="border border-navy-100 rounded-lg p-3 bg-navy-50/30"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-navy-900 text-sm font-medium">
                          {p.case_name}
                        </span>
                        <span className="text-xs font-mono bg-navy-100 px-2 py-0.5 rounded text-navy-600">
                          sim: {p.similarity.toFixed(3)}
                        </span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {p.factor_number && (
                          <span className="text-xs bg-gold-100 text-gold-800 px-1.5 py-0.5 rounded">
                            Factor {p.factor_number}
                          </span>
                        )}
                        {p.section_heading && (
                          <span className="text-xs bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded">
                            {p.section_heading}
                          </span>
                        )}
                      </div>
                      <p className="text-navy-600 text-xs leading-relaxed">
                        {p.text_preview}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsiblePanel>
            </section>
          )}

          {/* Doctrinal Timeline */}
          {result.matched_cases.length > 0 && (
            <section className="mb-8">
              <CollapsiblePanel
                title="Doctrinal Timeline"
                icon={<Calendar className="w-5 h-5 text-gold-600" />}
              >
                <p className="text-navy-600 text-xs mb-4">
                  Key precedents arranged chronologically. Cases after June 2023 reflect
                  post-Warhol doctrine, which narrowed transformative use analysis.
                </p>
                <div className="relative pl-6 border-l-2 border-navy-200 space-y-4">
                  {[...result.matched_cases]
                    .sort((a, b) => {
                      const ya = a.year ?? parseInt(a.date?.slice(0, 4) || "0", 10);
                      const yb = b.year ?? parseInt(b.date?.slice(0, 4) || "0", 10);
                      return ya - yb;
                    })
                    .map((c, i) => {
                      const caseYear = c.year ?? parseInt(c.date?.slice(0, 4) || "0", 10);
                      const isPostWarhol = c.is_post_warhol ?? (caseYear >= 2023);
                      return (
                        <div key={i} className="relative">
                          <div className={`absolute -left-8 w-4 h-4 rounded-full border-2 ${
                            c.jurisdiction_level === "SCOTUS"
                              ? "bg-gold-500 border-gold-600"
                              : isPostWarhol
                                ? "bg-purple-400 border-purple-500"
                                : "bg-navy-300 border-navy-400"
                          }`} />
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-navy-900 text-sm font-medium">
                              {c.case_name}
                            </span>
                            {c.jurisdiction_level === "SCOTUS" && (
                              <span className="text-xs bg-gold-100 text-gold-800 px-1.5 py-0.5 rounded font-medium">
                                SCOTUS
                              </span>
                            )}
                            {isPostWarhol && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                Post-Warhol
                              </span>
                            )}
                          </div>
                          <p className="text-navy-500 text-xs">
                            {caseYear || c.date} &middot; {c.court} &middot;{" "}
                            Fair use {c.fair_use_outcome.replace("_", " ")}
                            {c.procedural_posture ? ` &middot; ${c.procedural_posture.replace(/_/g, " ")}` : ""}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </CollapsiblePanel>
            </section>
          )}

          {/* VII. Overall Balanced Assessment */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
              VII. Overall Balanced Assessment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CollapsiblePanel
                title="Strengths"
                icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                defaultOpen
              >
                <ul className="space-y-3">
                  {result.overall_assessment.strengths.map((s, i) => (
                    <li key={i} className="text-navy-700 text-sm flex gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Weaknesses"
                icon={<TrendingDown className="w-5 h-5 text-red-500" />}
                defaultOpen
              >
                <ul className="space-y-3">
                  {result.overall_assessment.weaknesses.map((w, i) => (
                    <li key={i} className="text-navy-700 text-sm flex gap-2">
                      <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Litigation Risk Areas"
                icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                defaultOpen
              >
                <ul className="space-y-3">
                  {result.overall_assessment.litigation_risks.map((r, i) => (
                    <li key={i} className="text-navy-700 text-sm flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Fact-Dependent Uncertainties"
                icon={<HelpCircle className="w-5 h-5 text-navy-500" />}
                defaultOpen
              >
                <ul className="space-y-3">
                  {result.overall_assessment.fact_dependent_uncertainties.map(
                    (u, i) => (
                      <li key={i} className="text-navy-700 text-sm flex gap-2">
                        <HelpCircle className="w-4 h-4 text-navy-400 flex-shrink-0 mt-0.5" />
                        {u}
                      </li>
                    )
                  )}
                </ul>
              </CollapsiblePanel>
            </div>
          </section>

          {/* VIII. Precedent Status Summary */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
              VIII. Precedent Status Summary
            </h2>
            <PrecedentStatus precedents={result.precedent_statuses} />
          </section>

          {/* IX. Disclaimer */}
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-4">
              IX. Disclaimer
            </h2>
            <Disclaimer dateCutoff={result.date_cutoff} />
          </section>

          {/* Matched Cases (Expandable) */}
          <section className="mb-8">
            <CollapsiblePanel
              title="View Matched Case Summaries"
              icon={<Shield className="w-5 h-5 text-gold-600" />}
            >
              <div className="space-y-4">
                {result.matched_cases.map((c) => (
                  <div
                    key={c.case_id}
                    className="border border-navy-200 rounded-lg p-4"
                  >
                    <h4 className="font-bold text-navy-900 mb-1">
                      {c.case_name}
                    </h4>
                    <p className="text-navy-500 text-sm mb-2">{c.citation}</p>
                    <p className="text-navy-500 text-xs mb-2">
                      {c.court} &middot; {c.date} &middot; Fair use{" "}
                      {c.fair_use_outcome.replace("_", " ")}
                    </p>
                    <p className="text-navy-700 text-sm leading-relaxed">
                      {c.summary}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsiblePanel>
          </section>

          {/* Action Bar */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link
              href="/analyze"
              className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-6 py-3 rounded-xl font-semibold transition-colors shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
              Run Another Analysis
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

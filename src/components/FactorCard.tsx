"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  BookOpen,
  Quote,
  Scale,
} from "lucide-react";

interface FactorCardProps {
  factorNumber: 1 | 2 | 3 | 4;
  factorName: string;
  direction: string;
  weight: string;
  reasoning: string;
  keyCases: string[];
  keyQuotes: string[];
  governingPrinciples: string[];
  comparisonToFacts: string;
}

const ROMAN_NUMERALS: Record<1 | 2 | 3 | 4, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
};

function getDirectionStyles(direction: string) {
  const favors = ["strongly_favors", "favors"];
  const neutral = ["neutral"];
  const against = ["slightly_against", "against", "strongly_against"];
  const mixed = ["mixed"];

  if (favors.includes(direction))
    return {
      border: "border-l-emerald-500",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    };
  if (neutral.includes(direction))
    return {
      border: "border-l-amber-400",
      badge: "bg-amber-100 text-amber-800 border-amber-200",
    };
  if (against.includes(direction))
    return {
      border: "border-l-red-500",
      badge: "bg-red-100 text-red-800 border-red-200",
    };
  if (mixed.includes(direction))
    return {
      border: "border-l-navy-400",
      badge: "bg-navy-100 text-navy-800 border-navy-200",
    };
  return {
    border: "border-l-navy-300",
    badge: "bg-navy-100 text-navy-700 border-navy-200",
  };
}

function formatDirection(direction: string): string {
  return direction
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultExpanded: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultExpanded,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-navy-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-navy-50/50 hover:bg-navy-50 text-navy-800 font-medium text-left transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gold-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gold-600" />
        )}
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-navy-100">
          {children}
        </div>
      )}
    </div>
  );
}

export default function FactorCard({
  factorNumber,
  factorName,
  direction,
  weight,
  reasoning,
  keyCases,
  keyQuotes,
  governingPrinciples,
  comparisonToFacts,
}: FactorCardProps) {
  const { border, badge } = getDirectionStyles(direction);
  const paragraphs = reasoning.split(/\n\n+/).filter(Boolean);

  return (
    <article
      className={`bg-white rounded-xl border border-navy-200 border-l-4 ${border} shadow-md shadow-navy-900/5 overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-navy-100 bg-navy-50/30">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gold-500 text-navy-900 font-bold text-sm">
            {ROMAN_NUMERALS[factorNumber]}
          </span>
          <h3 className="text-lg font-semibold text-navy-900">{factorName}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${badge}`}
          >
            {formatDirection(direction)}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-navy-100 text-navy-700 border border-navy-200">
            {weight} Weight
          </span>
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="p-4 md:p-5 space-y-3">
        <CollapsibleSection
          title="Analysis"
          icon={<Scale className="w-4 h-4 text-gold-600" />}
          defaultExpanded
        >
          <div className="space-y-3 text-navy-700 text-sm leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </CollapsibleSection>

        {governingPrinciples.length > 0 && (
          <CollapsibleSection
            title="Governing Principles"
            icon={<BookOpen className="w-4 h-4 text-gold-600" />}
            defaultExpanded={false}
          >
            <ul className="space-y-2 text-navy-700 text-sm">
              {governingPrinciples.map((principle, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold-500 mt-0.5">•</span>
                  <span>{principle}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {keyQuotes.length > 0 && (
          <CollapsibleSection
            title="Key Quotes"
            icon={<Quote className="w-4 h-4 text-gold-600" />}
            defaultExpanded={false}
          >
            <div className="space-y-3">
              {keyQuotes.map((quote, i) => (
                <blockquote
                  key={i}
                  className="pl-4 border-l-4 border-gold-400 italic text-navy-700 text-sm py-1"
                >
                  &ldquo;{quote}&rdquo;
                </blockquote>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {comparisonToFacts && (
          <CollapsibleSection
            title="Comparison to Facts"
            icon={<Scale className="w-4 h-4 text-gold-600" />}
            defaultExpanded={false}
          >
            <p className="text-navy-700 text-sm leading-relaxed">
              {comparisonToFacts}
            </p>
          </CollapsibleSection>
        )}

        {keyCases.length > 0 && (
          <CollapsibleSection
            title="Key Cases Cited"
            icon={<BookOpen className="w-4 h-4 text-gold-600" />}
            defaultExpanded={false}
          >
            <ul className="space-y-2 text-navy-700 text-sm">
              {keyCases.map((caseName, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-gold-500 mt-0.5">•</span>
                  <span>{caseName}</span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}
      </div>
    </article>
  );
}

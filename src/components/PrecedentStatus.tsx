"use client";

import { Building2, BookMarked, Clock } from "lucide-react";

interface PrecedentStatusProps {
  precedents: Array<{
    case_name: string;
    citation: string;
    treatment_summary: string;
    later_citation_count: number;
    scotus_addressed: boolean;
    date_cutoff: string;
  }>;
}

export default function PrecedentStatus({ precedents }: PrecedentStatusProps) {
  if (precedents.length === 0) {
    return (
      <div className="bg-navy-50/50 rounded-xl border border-navy-200 p-6 text-center text-navy-600">
        No precedent data available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {precedents.map((precedent, i) => (
        <article
          key={`${precedent.case_name}-${i}`}
          className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 overflow-hidden"
        >
          <div className="p-4 md:p-5">
            {/* Header: Case name and badges */}
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div className="flex items-start gap-2 min-w-0">
                <Building2 className="w-5 h-5 text-gold-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-navy-900">{precedent.case_name}</h3>
                  <p className="flex items-center gap-1.5 text-sm text-navy-600 mt-0.5">
                    <BookMarked className="w-4 h-4 text-gold-600 shrink-0" />
                    {precedent.citation}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-navy-100 text-navy-700 border border-navy-200">
                  {precedent.later_citation_count} later citation
                  {precedent.later_citation_count !== 1 ? "s" : ""}
                </span>
                {precedent.scotus_addressed && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gold-100 text-gold-800 border border-gold-200">
                    SCOTUS Addressed
                  </span>
                )}
              </div>
            </div>

            {/* Treatment summary */}
            <p className="text-navy-700 text-sm leading-relaxed">
              {precedent.treatment_summary}
            </p>

            {/* Date cutoff */}
            {precedent.date_cutoff && (
              <div className="mt-3 pt-3 border-t border-navy-100 flex items-center gap-2 text-xs text-navy-500">
                <Clock className="w-4 h-4 text-gold-600 shrink-0" />
                <span>Date cutoff: {precedent.date_cutoff}</span>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Send, FileText, Scale, Info, MapPin } from "lucide-react";
import type { UseType, ScenarioInput, CircuitId } from "@/lib/types";

interface ScenarioFormProps {
  onSubmit: (data: ScenarioInput) => void;
  isLoading: boolean;
}

const WORK_TYPES = [
  "Music/Song",
  "Photograph",
  "Film/Video",
  "Literary Work/Book",
  "Software/Code",
  "Visual Art/Painting",
  "News Article",
  "Academic Paper",
  "Database/Data",
  "Other",
] as const;

const USE_TYPE_OPTIONS: { value: UseType; label: string }[] = [
  { value: "parody", label: "Parody" },
  { value: "commentary", label: "Commentary" },
  { value: "criticism", label: "Criticism" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "search_engine", label: "Search Engine" },
  { value: "music_sampling", label: "Music Sampling" },
  { value: "news_reporting", label: "News Reporting" },
  { value: "nonprofit_education", label: "Nonprofit Education" },
  { value: "commercial_remix", label: "Commercial Remix" },
  { value: "ai_training", label: "AI Training" },
  { value: "biographical_excerpt", label: "Biographical Excerpt" },
  { value: "software_api", label: "Software API" },
  { value: "archival", label: "Archival" },
  { value: "satire", label: "Satire" },
  { value: "artistic_appropriation", label: "Artistic Appropriation" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
];

const CIRCUIT_OPTIONS: { value: CircuitId; label: string }[] = [
  { value: null, label: "Not sure / Nationwide" },
  { value: "ca1", label: "1st Circuit (ME, MA, NH, RI, PR)" },
  { value: "ca2", label: "2nd Circuit (CT, NY, VT)" },
  { value: "ca3", label: "3rd Circuit (DE, NJ, PA, VI)" },
  { value: "ca4", label: "4th Circuit (MD, NC, SC, VA, WV)" },
  { value: "ca5", label: "5th Circuit (LA, MS, TX)" },
  { value: "ca6", label: "6th Circuit (KY, MI, OH, TN)" },
  { value: "ca7", label: "7th Circuit (IL, IN, WI)" },
  { value: "ca8", label: "8th Circuit (AR, IA, MN, MO, NE, ND, SD)" },
  { value: "ca9", label: "9th Circuit (AK, AZ, CA, HI, ID, MT, NV, OR, WA)" },
  { value: "ca10", label: "10th Circuit (CO, KS, NM, OK, UT, WY)" },
  { value: "ca11", label: "11th Circuit (AL, FL, GA)" },
  { value: "cadc", label: "D.C. Circuit" },
  { value: "cafc", label: "Federal Circuit" },
];

const MIN_DESCRIPTION_LENGTH = 20;
const MIN_PURPOSE_LENGTH = 3;

function getSliderZoneColor(percent: number): string {
  if (percent <= 25) return "bg-emerald-500";
  if (percent <= 75) return "bg-amber-500";
  return "bg-red-500";
}

export default function ScenarioForm({ onSubmit, isLoading }: ScenarioFormProps) {
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState("");
  const [useType, setUseType] = useState<UseType>("other");
  const [amountUsed, setAmountUsed] = useState(25);
  const [isCommercial, setIsCommercial] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [licensingAvailable, setLicensingAvailable] = useState<boolean | null>(
    null
  );
  const [additionalContext, setAdditionalContext] = useState("");
  const [jurisdiction, setJurisdiction] = useState<CircuitId>(null);
  const [errors, setErrors] = useState<{ description?: string; purpose?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { description?: string; purpose?: string } = {};

    if (!description.trim()) {
      newErrors.description = "Description is required.";
    } else if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      newErrors.description = `Please provide at least ${MIN_DESCRIPTION_LENGTH} characters describing your proposed use.`;
    }

    if (!purpose.trim()) {
      newErrors.purpose = "Purpose is required.";
    } else if (purpose.trim().length < MIN_PURPOSE_LENGTH) {
      newErrors.purpose = `Please provide at least ${MIN_PURPOSE_LENGTH} characters for the purpose.`;
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    onSubmit({
      description: description.trim(),
      work_type: workType || "Other",
      use_type: useType,
      amount_used: amountUsed,
      is_commercial: isCommercial,
      purpose: purpose.trim(),
      licensing_available: licensingAvailable,
      additional_context: additionalContext.trim(),
      jurisdiction,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 bg-white rounded-2xl border border-navy-200 shadow-lg shadow-navy-900/5 overflow-hidden"
    >
      {/* Section: Describe Your Proposed Use */}
      <section className="p-6 md:p-8 border-b border-navy-100">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-gold-600" />
          <h2 className="text-lg font-semibold text-navy-900">
            Describe Your Proposed Use
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-navy-700 mb-1"
            >
              Description
            </label>
            <p className="text-xs text-navy-500 mb-2">
              Describe the copyrighted work you want to use and how you plan to
              use it. Include relevant details about the context and audience.
            </p>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g., I want to use a 30-second clip from a documentary film in an educational video for my online course about film history..."
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.description
                  ? "border-red-500 focus:ring-red-500"
                  : "border-navy-200 focus:ring-gold-500"
              } focus:ring-2 focus:border-transparent bg-navy-50/50 text-navy-900 placeholder-navy-400 transition-colors`}
              disabled={isLoading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="purpose"
              className="block text-sm font-medium text-navy-700 mb-1"
            >
              Purpose
            </label>
            <p className="text-xs text-navy-500 mb-2">
              The primary purpose of your use (e.g., commentary, parody,
              education).
            </p>
            <input
              id="purpose"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., commentary, parody, education"
              className={`w-full px-4 py-3 rounded-lg border ${
                errors.purpose
                  ? "border-red-500 focus:ring-red-500"
                  : "border-navy-200 focus:ring-gold-500"
              } focus:ring-2 focus:border-transparent bg-navy-50/50 text-navy-900 placeholder-navy-400 transition-colors`}
              disabled={isLoading}
            />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600">{errors.purpose}</p>
            )}
          </div>
        </div>
      </section>

      {/* Section: Original Work Details */}
      <section className="p-6 md:p-8 border-b border-navy-100">
        <div className="flex items-center gap-2 mb-6">
          <Scale className="w-5 h-5 text-gold-600" />
          <h2 className="text-lg font-semibold text-navy-900">
            Original Work Details
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="work_type"
              className="block text-sm font-medium text-navy-700 mb-1"
            >
              Work Type
            </label>
            <p className="text-xs text-navy-500 mb-2">
              The category of the copyrighted work you&apos;re using.
            </p>
            <select
              id="work_type"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900 transition-colors"
              disabled={isLoading}
            >
              <option value="">Select work type...</option>
              {WORK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="use_type"
              className="block text-sm font-medium text-navy-700 mb-1"
            >
              Use Type
            </label>
            <p className="text-xs text-navy-500 mb-2">
              The nature of your use under fair use analysis.
            </p>
            <select
              id="use_type"
              value={useType}
              onChange={(e) => setUseType(e.target.value as UseType)}
              className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900 transition-colors"
              disabled={isLoading}
            >
              {USE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Section: Usage Details */}
      <section className="p-6 md:p-8 border-b border-navy-100">
        <div className="flex items-center gap-2 mb-6">
          <Info className="w-5 h-5 text-gold-600" />
          <h2 className="text-lg font-semibold text-navy-900">
            Usage Details
          </h2>
        </div>

        <div className="space-y-6">
          {/* Amount Used - Slider */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Amount Used
            </label>
            <p className="text-xs text-navy-500 mb-3">
              Approximately what portion of the original work will you use?
              (Factor 3 of fair use)
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <div className="h-3 rounded-full bg-navy-200 overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-200 ${getSliderZoneColor(amountUsed)}`}
                    style={{ width: `${amountUsed}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={amountUsed}
                  onChange={(e) => setAmountUsed(Number(e.target.value))}
                  className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
              </div>
              <span
                className={`inline-flex items-center justify-center min-w-[4rem] px-3 py-1.5 rounded-lg font-semibold text-sm text-white ${getSliderZoneColor(amountUsed)}`}
              >
                {amountUsed}%
              </span>
            </div>
            <div className="flex justify-between mt-1 text-xs text-navy-500">
              <span>Minimal</span>
              <span>Moderate</span>
              <span>Substantial</span>
            </div>
          </div>

          {/* Commercial */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Commercial?
            </label>
            <p className="text-xs text-navy-500 mb-2">
              Will this use generate revenue or serve a commercial purpose?
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="commercial"
                  checked={!isCommercial}
                  onChange={() => setIsCommercial(false)}
                  className="w-4 h-4 text-gold-600 border-navy-300 focus:ring-gold-500"
                  disabled={isLoading}
                />
                <span className="text-navy-700">No</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="commercial"
                  checked={isCommercial}
                  onChange={() => setIsCommercial(true)}
                  className="w-4 h-4 text-gold-600 border-navy-300 focus:ring-gold-500"
                  disabled={isLoading}
                />
                <span className="text-navy-700">Yes</span>
              </label>
            </div>
          </div>

          {/* Licensing Available */}
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1">
              Is licensing available?
            </label>
            <p className="text-xs text-navy-500 mb-2">
              Can you obtain a license for this use? (Factor 4 consideration)
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { value: true as const, label: "Yes" },
                { value: false as const, label: "No" },
                { value: null, label: "Unknown" },
              ].map((opt) => (
                <label
                  key={String(opt.value)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="licensing"
                    checked={licensingAvailable === opt.value}
                    onChange={() => setLicensingAvailable(opt.value)}
                    className="w-4 h-4 text-gold-600 border-navy-300 focus:ring-gold-500"
                    disabled={isLoading}
                  />
                  <span className="text-navy-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Context */}
          <div>
            <label
              htmlFor="additional_context"
              className="block text-sm font-medium text-navy-700 mb-1"
            >
              Additional Context
            </label>
            <p className="text-xs text-navy-500 mb-2">
              Any other relevant details that may affect the fair use analysis.
            </p>
            <textarea
              id="additional_context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              placeholder="e.g., market considerations, transformative elements, audience..."
              className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900 placeholder-navy-400 transition-colors"
              disabled={isLoading}
            />
          </div>
        </div>
      </section>

      {/* Section: Jurisdiction (Optional) */}
      <section className="p-6 md:p-8 border-b border-navy-100">
        <div className="flex items-center gap-2 mb-6">
          <MapPin className="w-5 h-5 text-gold-600" />
          <h2 className="text-lg font-semibold text-navy-900">
            Jurisdiction
          </h2>
          <span className="text-xs text-navy-400 font-normal">(Optional)</span>
        </div>

        <div>
          <label
            htmlFor="jurisdiction"
            className="block text-sm font-medium text-navy-700 mb-1"
          >
            Primary Circuit
          </label>
          <p className="text-xs text-navy-500 mb-2">
            Select your federal circuit to prioritize relevant precedent.
            Cases from your circuit and SCOTUS will be weighted higher.
          </p>
          <select
            id="jurisdiction"
            value={jurisdiction ?? ""}
            onChange={(e) =>
              setJurisdiction(
                e.target.value ? (e.target.value as CircuitId) : null
              )
            }
            className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900 transition-colors"
            disabled={isLoading}
          >
            {CIRCUIT_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Submit */}
      <div className="p-6 md:p-8 bg-navy-50/30">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-900 font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-navy-900"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Analyze My Proposed Use</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

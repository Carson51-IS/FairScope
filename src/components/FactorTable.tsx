"use client";

interface FactorTableProps {
  factors: Array<{
    factor_number: number;
    factor_name: string;
    direction: string;
    weight: string;
    key_cases: string[];
  }>;
}

const ROMAN_NUMERALS: Record<number, string> = {
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
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (neutral.includes(direction))
    return "text-amber-800 bg-amber-50 border-amber-200";
  if (against.includes(direction))
    return "text-red-700 bg-red-50 border-red-200";
  if (mixed.includes(direction))
    return "text-navy-700 bg-navy-50 border-navy-200";
  return "text-navy-700 bg-navy-50 border-navy-200";
}

function formatDirection(direction: string): string {
  return direction
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function FactorTable({ factors }: FactorTableProps) {
  return (
    <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs leading-relaxed">
        <strong>Note:</strong> Courts do not apply mathematical scoring to fair use factors.
        The directions and weights shown here are heuristic indicators derived from case law analysis
        and should not be interpreted as doctrinal precision. Courts may weigh factors differently
        based on the specific facts, and sometimes explicitly refuse mechanical balancing.
      </div>
      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-navy-900 text-white">
              <th className="px-4 py-3 font-semibold text-sm">Factor</th>
              <th className="px-4 py-3 font-semibold text-sm">Direction</th>
              <th className="px-4 py-3 font-semibold text-sm">
                Relative Weight
              </th>
              <th className="px-4 py-3 font-semibold text-sm">
                Key Cases Relied On
              </th>
            </tr>
          </thead>
          <tbody>
            {factors.map((factor, i) => (
              <tr
                key={factor.factor_number}
                className={
                  i % 2 === 0
                    ? "bg-white border-b border-navy-100"
                    : "bg-navy-50/30 border-b border-navy-100"
                }
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-navy-900">
                    {ROMAN_NUMERALS[factor.factor_number] || factor.factor_number}
                    . {factor.factor_name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${getDirectionStyles(
                      factor.direction
                    )}`}
                  >
                    {formatDirection(factor.direction)}
                  </span>
                </td>
                <td className="px-4 py-3 text-navy-700 text-sm">
                  {factor.weight}
                </td>
                <td className="px-4 py-3 text-navy-600 text-sm">
                  {factor.key_cases.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {factor.key_cases.map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-navy-400 italic">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Stacked cards */}
      <div className="md:hidden divide-y divide-navy-100">
        {factors.map((factor) => (
          <div
            key={factor.factor_number}
            className="p-4 bg-white first:rounded-t-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gold-500 text-navy-900 font-bold text-xs">
                {ROMAN_NUMERALS[factor.factor_number] || factor.factor_number}
              </span>
              <h3 className="font-semibold text-navy-900">{factor.factor_name}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-navy-500 font-medium">Direction:</span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getDirectionStyles(
                    factor.direction
                  )}`}
                >
                  {formatDirection(factor.direction)}
                </span>
              </div>
              <div>
                <span className="text-navy-500 font-medium">
                  Relative Weight:
                </span>{" "}
                <span className="text-navy-700">{factor.weight}</span>
              </div>
              <div>
                <span className="text-navy-500 font-medium block mb-1">
                  Key Cases Relied On:
                </span>
                {factor.key_cases.length > 0 ? (
                  <ul className="list-disc list-inside text-navy-600 space-y-0.5">
                    {factor.key_cases.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-navy-400 italic">—</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

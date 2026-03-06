import { AlertTriangle } from "lucide-react";

interface DisclaimerProps {
  dateCutoff: string;
}

export default function Disclaimer({ dateCutoff }: DisclaimerProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mt-8">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-900 text-lg mb-2">
            Important Disclaimer
          </h3>
          <p className="text-amber-800 text-sm leading-relaxed mb-3">
            This analysis is informational and based only on the cases reviewed.
            It does not constitute legal advice. You should consult a qualified
            copyright attorney before relying on this analysis.
          </p>
          <p className="text-amber-700 text-xs">
            Analysis based on federal cases available through{" "}
            <span className="font-mono font-semibold">{dateCutoff}</span>.
            FairScope analyzes U.S. federal fair use law only (17 U.S.C. &sect;
            107). State law claims are outside its scope.
          </p>
        </div>
      </div>
    </div>
  );
}

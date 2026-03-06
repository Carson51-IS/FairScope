import { Scale } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-navy-800 text-navy-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <Scale className="w-4 h-4 text-navy-950" />
              </div>
              <span className="text-white font-bold text-lg">
                Fair<span className="text-gold-400">Scope</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">
              A structured federal fair-use research engine that retrieves and
              applies 17 U.S.C. &sect; 107 case law to user-described facts.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Important Notice
            </h3>
            <p className="text-sm leading-relaxed">
              FairScope provides informational analysis only. It does not
              constitute legal advice. Always consult a qualified copyright
              attorney before making decisions based on this analysis.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Scope
            </h3>
            <ul className="text-sm space-y-2">
              <li>U.S. Federal law only</li>
              <li>17 U.S.C. &sect; 107 fair use analysis</li>
              <li>SCOTUS, Circuit, and District Court opinions</li>
              <li>Factor-based analysis framework</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-navy-800 mt-8 pt-8 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} FairScope. This tool is for
            informational and educational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}

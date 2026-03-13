import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeCTA from "@/components/HomeCTA";
import {
  Scale,
  BookOpen,
  Shield,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-navy-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 via-transparent to-navy-800/20" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(16, 42, 67, 0.3) 0%, transparent 50%)",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-navy-800/50 border border-navy-700 text-navy-200 text-sm mb-8">
              <Scale className="w-4 h-4 text-gold-400" />
              <span>17 U.S.C. &sect; 107 Research Engine</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Federal Fair Use Analysis{" "}
              <span className="gradient-text">Powered by Case Law</span>
            </h1>

            <p className="text-navy-300 text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
              FairScope retrieves and applies federal court opinions
              interpreting &sect; 107 to your specific facts. Structured
              factor-by-factor analysis with citations, quotations, and
              precedent status tracking.
            </p>

            <HomeCTA />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy-50 to-transparent" />
      </section>

      {/* What FairScope Does */}
      <section className="py-20 bg-navy-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-4">
              How FairScope Works
            </h2>
            <p className="text-navy-600 text-lg max-w-2xl mx-auto">
              A structured research workflow that mirrors how experienced
              copyright attorneys approach fair use analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Scenario Analysis",
                description:
                  "Describe your proposed use. FairScope extracts structured features: work type, use type, commercial status, transformative elements, and market risk.",
              },
              {
                icon: <Search className="w-6 h-6" />,
                title: "Case Retrieval",
                description:
                  "Hybrid retrieval matches your facts against federal court opinions that substantively interpret \u00a7 107. Factor-specific passage selection ensures balanced analysis.",
              },
              {
                icon: <Scale className="w-6 h-6" />,
                title: "Factor Analysis",
                description:
                  "Each of the four statutory factors is analyzed with governing principles, case comparisons, key quotations, and a directional assessment.",
              },
              {
                icon: <BookOpen className="w-6 h-6" />,
                title: "Precedent Status",
                description:
                  "Built-in citation graph tracks how cases have been treated: followed, applied, distinguished, criticized, or overruled.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-navy-200 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 mb-4">
                  {step.icon}
                </div>
                <h3 className="font-semibold text-navy-900 text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-navy-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What FairScope IS and IS NOT */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                <h3 className="font-display text-2xl font-bold text-emerald-900">
                  FairScope Is
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "A structured federal fair-use research engine",
                  "Based on U.S. Supreme Court, Circuit, and District Court opinions",
                  "Factor-by-factor analysis with citations and quotations",
                  "Precedent tracking with citation graph analysis",
                  "Probabilistic language reflecting legal uncertainty",
                  "Transparent about its limitations and data cutoff",
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="w-7 h-7 text-red-600" />
                <h3 className="font-display text-2xl font-bold text-red-900">
                  FairScope Is Not
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "An AI that decides if something is legal",
                  "A substitute for qualified legal counsel",
                  "Applicable to state law or non-U.S. jurisdictions",
                  "A guarantee of any particular legal outcome",
                  "Legal advice or an attorney-client relationship",
                  "A complete survey of all relevant case law",
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-red-800">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Corpus Section */}
      <section className="py-20 bg-navy-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-navy-900 mb-4">
              Built on Federal Case Law
            </h2>
            <p className="text-navy-600 text-lg max-w-2xl mx-auto">
              Only opinions that substantively interpret 17 U.S.C. &sect; 107
              and apply factor analysis &mdash; not cases that merely mention
              &ldquo;fair use&rdquo; in passing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Shield className="w-6 h-6" />,
                title: "U.S. Supreme Court",
                items: [
                  "Campbell v. Acuff-Rose Music",
                  "Google LLC v. Oracle America",
                  "Andy Warhol Foundation v. Goldsmith",
                  "Harper & Row v. Nation Enterprises",
                  "Sony Corp. v. Universal City Studios",
                ],
              },
              {
                icon: <Scale className="w-6 h-6" />,
                title: "Federal Courts of Appeals",
                items: [
                  "Authors Guild v. Google (2d Cir.)",
                  "Perfect 10 v. Amazon (9th Cir.)",
                  "Cariou v. Prince (2d Cir.)",
                  "Blanch v. Koons (2d Cir.)",
                  "Swatch Group v. Bloomberg (2d Cir.)",
                ],
              },
              {
                icon: <BookOpen className="w-6 h-6" />,
                title: "Analysis Covers",
                items: [
                  "Parody, Commentary, Criticism",
                  "Search Engines & Thumbnails",
                  "Appropriation Art",
                  "Software APIs",
                  "News Reporting & Education",
                ],
              },
            ].map((col, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-navy-200 p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center text-gold-400 mb-4">
                  {col.icon}
                </div>
                <h3 className="font-semibold text-navy-900 text-lg mb-4">
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.items.map((item, j) => (
                    <li
                      key={j}
                      className="text-navy-600 text-sm flex items-start gap-2"
                    >
                      <span className="text-gold-500 mt-1">&bull;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-navy-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to analyze your proposed use?
          </h2>
          <p className="text-navy-300 text-lg mb-8 max-w-2xl mx-auto">
            Get a structured, factor-by-factor analysis grounded in federal case
            law. FairScope shows you how courts have treated similar uses under
            &sect; 107.
          </p>
          <HomeCTA />
        </div>
      </section>

      <Footer />
    </div>
  );
}

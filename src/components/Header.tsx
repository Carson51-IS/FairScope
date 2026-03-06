"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-navy-950 border-b border-navy-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20 group-hover:shadow-gold-500/40 transition-shadow">
              <Scale className="w-5 h-5 text-navy-950" />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">
                Fair
              </span>
              <span className="text-gold-400 font-bold text-lg tracking-tight">
                Scope
              </span>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link
              href="/"
              className="text-navy-300 hover:text-white text-sm font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              href="/analyze"
              className="text-navy-300 hover:text-white text-sm font-medium transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/analyze"
              className="bg-gold-500 hover:bg-gold-400 text-navy-950 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-gold-500/20"
            >
              Start Analysis
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function HomeCTA() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        const res = await fetch("/api/subscription/status");
        const data = await res.json();
        setSubscribed(!!data.active);
      }
      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="h-12 w-48 bg-navy-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/signup"
          className="group flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40"
        >
          Sign up to get started
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/login"
          className="text-navy-300 hover:text-white font-medium"
        >
          Already have an account? Log in
        </Link>
      </div>
    );
  }

  if (!subscribed) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/analyze"
          className="group flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40"
        >
          Subscribe with Stripe — $1/month
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Link
        href="/analyze"
        className="group flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40"
      >
        Analyze My Proposed Use
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}

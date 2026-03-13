"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Scale, ChevronDown, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetch("/api/subscription/status")
          .then((r) => r.json())
          .then((d) => setSubscribed(!!d.active));
      } else {
        setSubscribed(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSubscribed(false);
    setMenuOpen(false);
    window.location.href = "/";
  };

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

            {user ? (
              <>
                <Link
                  href="/analyze"
                  className="text-navy-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Analyze
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 text-navy-300 hover:text-white text-sm font-medium"
                  >
                    {user.email ?? "Account"}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-48 py-2 bg-navy-800 rounded-lg shadow-lg z-20 border border-navy-700">
                        <Link
                          href="/settings"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-navy-200 hover:bg-navy-700"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-navy-200 hover:bg-navy-700"
                        >
                          <LogOut className="w-4 h-4" />
                          Log out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-navy-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-gold-500 hover:bg-gold-400 text-navy-950 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-gold-500/20"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

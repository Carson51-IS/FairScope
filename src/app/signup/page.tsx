"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { Scale } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signUp(
        { email: email.trim().toLowerCase(), password },
        { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined }
      );

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      setLoading(false);

      if (data.session) {
        router.push(redirect);
        router.refresh();
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  if (success && !loading) {
    return (
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-navy-200 shadow-md p-8 text-center">
            <h2 className="font-display text-xl font-bold text-navy-900 mb-2">Check your email</h2>
            <p className="text-navy-600 text-sm mb-6">
              We sent a confirmation link to {email}. Click it to activate your account.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-gold-600 hover:text-gold-500 font-medium"
            >
              Back to login
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-50">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-navy-200 shadow-md shadow-navy-900/5 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <Scale className="w-5 h-5 text-navy-950" />
              </div>
              <h1 className="font-display text-2xl font-bold text-navy-900">Sign up</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-navy-200 focus:ring-2 focus:ring-gold-500 focus:border-transparent bg-navy-50/50 text-navy-900"
                  placeholder="At least 6 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:bg-gold-400 disabled:cursor-not-allowed text-navy-950 font-semibold transition-colors"
              >
                {loading ? "Creating account..." : "Sign up"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-navy-600">
              Already have an account?{" "}
              <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="text-gold-600 hover:text-gold-500 font-medium">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-navy-50">
        <Header />
        <main className="flex-1 flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-gold-500" />
        </main>
        <Footer />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

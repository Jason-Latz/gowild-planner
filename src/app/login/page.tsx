"use client";

import Link from "next/link";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus("error");
      setMessage("Sign-in is not configured in this environment.");
      return;
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(`We sent a magic sign-in link to ${trimmed}. Open it on this device to continue.`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="rounded-3xl border border-stone-900/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in to GoWild Explorer</h1>
        <p className="mt-2 text-sm text-stone-600">
          Enter your email and we&apos;ll send a one-time magic link — no password required.
        </p>

        <form onSubmit={sendMagicLink} className="mt-5 grid gap-3">
          <label className="text-sm">
            Email
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={status === "sending" || status === "sent"}
            />
          </label>

          <button
            type="submit"
            disabled={status === "sending" || status === "sent"}
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : status === "sent" ? "Link sent" : "Send magic link"}
          </button>
        </form>

        {message ? (
          <p
            className={`mt-4 text-sm ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <p className="text-center text-xs text-stone-500">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}

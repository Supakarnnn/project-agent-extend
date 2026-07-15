"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Login failed");
      }
      router.replace("/admin");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[var(--bg)] md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-[var(--surface)] p-12 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(120% 80% at 0% 0%, var(--moss), transparent 60%)" }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-accent" />
          <span className="text-[15px] font-medium tracking-tight">Meridian</span>
        </div>
        <div className="relative">
          <span className="eyebrow">/ back office</span>
          <h1 className="display mt-5 text-bone" style={{ fontSize: "clamp(2.4rem,4vw,3.6rem)" }}>
            Manage the<br />
            <span className="italic text-accent">whole protocol.</span>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--bone-dim)]">
            Products, inventory, and the concierge transcript — one console for the
            people behind Meridian.
          </p>
        </div>
        <div className="relative flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-8 rounded-full bg-[var(--moss)]" />
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-9">
            <span className="eyebrow">/ sign in</span>
            <h2 className="display mt-4 text-3xl text-bone">Welcome back</h2>
            <p className="mt-2 text-sm text-[var(--bone-dim)]">
              Authorized personnel only.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="eyebrow mb-2 block">Username</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                className="w-full rounded-lg border border-line bg-[var(--surface)] px-4 py-3 text-bone outline-none transition-colors focus:border-[var(--moss)] placeholder:text-[var(--muted)]"
              />
            </div>

            <div>
              <label className="eyebrow mb-2 block">Password</label>
              <div className="flex items-center rounded-lg border border-line bg-[var(--surface)] transition-colors focus-within:border-[var(--moss)]">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                  className="w-full bg-transparent px-4 py-3 text-bone outline-none placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="px-4 font-mono text-[11px] uppercase tracking-widest text-[var(--muted)] hover:text-bone"
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {err && (
              <p className="rounded-lg border border-[#5a2b2b] bg-[#1c1212] px-3 py-2 text-sm text-[#e6a8a8]">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-accent py-3.5 text-sm font-medium text-[#0a0e0c] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 font-mono text-[11px] text-[var(--muted)]">
            Protected area. Authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}

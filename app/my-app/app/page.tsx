"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Chatbot from "./components/Chatbot";

const PRODUCTS = [
  {
    n: "01",
    name: "Cellular NMN+",
    cat: "Longevity",
    desc: "NAD+ precursor with TMG methyl donor. The metabolic foundation.",
    price: 64,
  },
  {
    n: "02",
    name: "Mineral Sleep",
    cat: "Recovery",
    desc: "Magnesium glycinate and L-theanine for uninterrupted deep sleep.",
    price: 42,
  },
  {
    n: "03",
    name: "Pulse Monitor",
    cat: "Diagnostics",
    desc: "Continuous glucose, HRV and recovery, streamed to your protocol.",
    price: 189,
  },
  {
    n: "04",
    name: "Daily Bioactives",
    cat: "Foundation",
    desc: "Twenty-three actives at clinical dose. One scoop, fully traceable.",
    price: 48,
  },
];

const STEPS = [
  {
    k: "Measure",
    t: "We start with data, not guesses",
    d: "A baseline panel maps your blood markers, recovery and metabolic response — the inputs no questionnaire can capture.",
  },
  {
    k: "Formulate",
    t: "Protocols built for one body",
    d: "Your results compile into a protocol at clinical dose. Nothing speculative, nothing under-dosed, every ingredient justified.",
  },
  {
    k: "Adapt",
    t: "The plan learns as you do",
    d: "Pulse feeds live signal back into Meridian. Your concierge adjusts the protocol the moment your body's response shifts.",
  },
];

const STATS = [
  { v: 41, suf: "k", l: "Members optimized" },
  { v: 100, suf: "%", l: "Batches third-party tested" },
  { v: 23, suf: "", l: "Biomarkers tracked" },
  { v: 9.4, suf: "/10", l: "Member-rated concierge" },
];

export default function Home() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context((self) => {
      // Hero staggered reveal
      gsap.set(".reveal", { opacity: 1 });
      gsap.from(".hero-line", {
        yPercent: 120,
        opacity: 0,
        duration: 1.1,
        ease: "power4.out",
        stagger: 0.12,
        delay: 0.15,
      });
      gsap.from(".hero-fade", {
        y: 24,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.1,
        delay: 0.7,
      });

      if (reduce) return;

      // Generic scroll reveals
      const groups = self.selector!(".rise") as HTMLElement[];
      groups.forEach((el) => {
        gsap.from(el, {
          y: 60,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // Product cards stagger
      gsap.from(".product-card", {
        y: 70,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".product-grid", start: "top 78%" },
      });

      // Stat counters
      (self.selector!(".stat-num") as HTMLElement[]).forEach((el) => {
        const end = parseFloat(el.dataset.to || "0");
        const isFloat = end % 1 !== 0;
        const obj = { v: 0 };
        gsap.to(obj, {
          v: end,
          duration: 1.8,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
          onUpdate: () => {
            el.textContent = isFloat ? obj.v.toFixed(1) : Math.round(obj.v).toString();
          },
        });
      });

      // Section heading mask wipes
      (self.selector!(".wipe") as HTMLElement[]).forEach((el) => {
        gsap.from(el, {
          clipPath: "inset(0 100% 0 0)",
          duration: 1.1,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 82%" },
        });
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="relative">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-accent" />
          <span className="text-[15px] font-medium tracking-tight">Meridian</span>
        </div>
        <nav className="hidden gap-9 font-mono text-xs uppercase tracking-widest text-[var(--bone-dim)] md:flex">
          <a href="#shop" className="transition-colors hover:text-bone">Shop</a>
          <a href="#method" className="transition-colors hover:text-bone">Method</a>
          <a href="#concierge" className="transition-colors hover:text-bone">Concierge</a>
        </nav>
        <a
          href="#shop"
          className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-[var(--moss)] hover:bg-[var(--surface)]"
        >
          Start now
        </a>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden px-6 md:px-12">
        <video
          className="absolute inset-0 -z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/file.svg"
          aria-hidden
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* Cozy, readable scrim: warm tint + left-weighted darkening + vignette */}
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "linear-gradient(90deg, var(--bg) 0%, rgba(10,14,12,0.72) 38%, rgba(10,14,12,0.30) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-0 mix-blend-multiply"
          style={{ background: "radial-gradient(120% 90% at 70% 20%, transparent 35%, var(--bg) 85%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-0 opacity-25 mix-blend-soft-light"
          style={{ background: "linear-gradient(120deg, #e3bd97 0%, transparent 55%)" }}
        />
        <div className="relative z-10 w-full max-w-5xl">
          <p className="reveal hero-fade eyebrow mb-8">Longevity, engineered</p>
          <h1 className="display text-bone" style={{ fontSize: "clamp(2.8rem, 9vw, 7.5rem)" }}>
            <span className="block overflow-hidden">
              <span className="hero-line block">Precision health,</span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-line block">
                grown from <span className="italic text-accent">first</span>
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="hero-line block italic text-accent">principles.</span>
            </span>
          </h1>
          <div className="mt-10 flex max-w-xl flex-col gap-7 sm:flex-row sm:items-center">
            <p className="reveal hero-fade max-w-sm text-[15px] leading-relaxed text-[var(--bone-dim)]">
              Clinically formulated supplements, real diagnostics, and a concierge that
              actually knows your body. No wellness theater.
            </p>
            <a
              href="#shop"
              className="reveal hero-fade group inline-flex shrink-0 items-center gap-3 rounded-full bg-bone px-6 py-3.5 text-sm font-medium text-[#0a0e0c] transition-transform hover:scale-[1.03]"
            >
              Explore the protocol
              <span className="transition-transform group-hover:translate-x-1">&#8594;</span>
            </a>
          </div>
        </div>
        <div className="reveal hero-fade absolute bottom-8 left-6 right-6 hidden items-end justify-between font-mono text-[11px] uppercase tracking-widest text-[var(--muted)] md:flex md:left-12 md:right-12">
          <span>Est. 2026 — Zurich</span>
          <span>Scroll to begin</span>
        </div>
      </section>

      {/* Marquee */}
      <div className="grain-line border-y border-line py-5 md:py-7">
        <div className="flex w-max marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {["Third-party tested", "Clinical dose", "No fillers", "Carbon neutral", "NSF certified", "Traceable batches"].map(
                (w) => (
                  <span key={w} className="flex items-center">
                    <span className="display px-8 text-3xl text-[var(--bone-dim)] md:text-4xl">
                      {w}
                    </span>
                    <span className="h-1.5 w-1.5 rotate-45 bg-accent" />
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Shop */}
      <section id="shop" className="px-6 py-28 md:px-12 md:py-36">
        <div className="rise mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="eyebrow">/ the shelf</span>
            <h2 className="wipe display mt-5 text-bone" style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)" }}>
              Four formulas.<br />Nothing you don&apos;t need.
            </h2>
          </div>
          <p className="max-w-xs text-[15px] leading-relaxed text-[var(--bone-dim)]">
            We&apos;d rather make four products well than forty to fill a catalog. Each one
            earns its place with evidence.
          </p>
        </div>

        <div className="product-grid grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <article
              key={p.name}
              className="product-card lift group flex flex-col justify-between gap-12 bg-[var(--surface)] p-7"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-[var(--muted)]">{p.n}</span>
                <span className="rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--bone-dim)]">
                  {p.cat}
                </span>
              </div>
              <div>
                <h3 className="display text-2xl text-bone">{p.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--bone-dim)]">{p.desc}</p>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                  <span className="text-lg text-bone">${p.price}</span>
                  <span className="font-mono text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    Add &#43;
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="relative px-6 py-28 md:px-12 md:py-36">
        <div className="rise mb-20 max-w-2xl">
          <span className="eyebrow">/ the method</span>
          <h2 className="wipe display mt-5 text-bone" style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)" }}>
            Care that compounds.
          </h2>
        </div>
        <div className="flex flex-col">
          {STEPS.map((s, i) => (
            <div
              key={s.k}
              className="rise grid grid-cols-1 gap-6 border-t border-line py-12 md:grid-cols-[0.5fr_1fr_1.2fr] md:py-16"
            >
              <span className="font-mono text-sm text-accent">0{i + 1}</span>
              <h3 className="display text-3xl text-bone md:text-4xl">{s.t}</h3>
              <div>
                <span className="eyebrow">{s.k}</span>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--bone-dim)]">
                  {s.d}
                </p>
              </div>
            </div>
          ))}
          <div className="border-t border-line" />
        </div>

        {/* Stats */}
        <div className="rise mt-24 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.l} className="bg-[var(--surface)] p-8">
              <div className="display flex items-baseline text-bone" style={{ fontSize: "clamp(2.5rem,4vw,3.5rem)" }}>
                <span className="stat-num" data-to={s.v}>0</span>
                <span className="text-accent">{s.suf}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--bone-dim)]">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Concierge / Chatbot */}
      <section id="concierge" className="px-6 py-28 md:px-12 md:py-36">
        <div className="rise mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <span className="eyebrow">/ always on</span>
            <h2 className="wipe display mt-5 text-bone" style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)" }}>
              A clinic in your pocket.
            </h2>
          </div>
          <p className="max-w-xs text-[15px] leading-relaxed text-[var(--bone-dim)]">
            Ask anything — symptoms, ingredients, timing, interactions. Vera answers
            instantly and hands off to a human clinician when it matters.
          </p>
        </div>
        <div className="rise">
          <Chatbot />
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="relative overflow-hidden border-t border-line px-6 py-24 md:px-12 md:py-32">
        <div className="rise mx-auto max-w-4xl text-center">
          <span className="eyebrow">/ begin</span>
          <h2 className="display mt-6 text-bone" style={{ fontSize: "clamp(2.6rem, 7vw, 6rem)" }}>
            Your baseline is<br /><span className="italic text-accent">today.</span>
          </h2>
          <a
            href="#shop"
            className="mt-12 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-sm font-medium text-[#0a0e0c] transition-transform hover:scale-[1.03]"
          >
            Build my protocol
            <span>&#8594;</span>
          </a>
        </div>
        <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-line pt-10 font-mono text-[11px] uppercase tracking-widest text-[var(--muted)] md:flex-row">
          <span>Meridian Health — Est. 2026</span>
          <div className="flex gap-8">
            <a href="#" className="transition-colors hover:text-bone">Instagram</a>
            <a href="#" className="transition-colors hover:text-bone">Journal</a>
            <a href="#" className="transition-colors hover:text-bone">Careers</a>
          </div>
          <span>Not medical advice.</span>
        </div>
      </footer>
    </div>
  );
}

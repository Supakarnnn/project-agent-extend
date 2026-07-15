"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { apiUrl } from "../lib/api";

type Msg = { role: "user" | "bot"; text: string };
type ApiMsg = { role: "human" | "ai"; content: string };

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2.5 text-[13.5px] leading-[1.7] text-[var(--bone)] last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--accent)] not-italic">{children}</strong>,
  em: ({ children }) => <em className="not-italic text-[var(--bone-dim)]">{children}</em>,
  ul: ({ children }) => <ul className="mt-1 list-none space-y-0 pl-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1 list-none space-y-0 pl-0">{children}</ol>,
  li: ({ children }) => <li className="mt-3 border-t border-[var(--line)] pt-3 text-[13.5px] leading-[1.7] text-[var(--bone-dim)] first:mt-0 first:border-0 first:pt-0">{children}</li>,
  code: ({ children }) => <code className="rounded bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--bone-dim)]">{children}</code>,
};

const SUGGESTIONS = ["I sleep badly", "Boost daily energy", "What is Pulse?", "Are these third-party tested?"];
const GREETING = "I'm Vera, your Meridian health concierge. Tell me what you're optimizing for and I'll point you to the right protocol.";

export default function Chatbot() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text: msg }];
    setMessages(next);
    setBusy(true);
    try {
      const history: ApiMsg[] = next
        .filter((m) => m.role !== "bot" || m.text !== GREETING)
        .map((m) => ({ role: m.role === "user" ? "human" : "ai", content: m.text }));
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: data.response ?? "Something went wrong. Try again." }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "I couldn't reach the network. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[var(--bg-deep,#070a08)]">
      <div className="flex h-[clamp(520px,70vh,680px)] flex-col">
        <div className="flex items-center gap-2.5 border-b border-line px-6 py-4">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-xs tracking-wide text-[var(--bone-dim)]">Vera / online</span>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-8 md:px-10">
          {messages.length === 1 && (
            <div className="mx-auto mb-8 max-w-2xl text-center">
              <span className="eyebrow">/ concierge</span>
              <h3 className="display mt-4 text-4xl text-bone md:text-5xl">Ask Vera<span className="text-accent">.</span></h3>
              <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--bone-dim)]">
                A 24/7 assistant trained on our clinical library. Ask about symptoms, ingredients, timing, or your daily protocol.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mx-auto flex w-full max-w-5xl ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "user" ? (
                <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-[14px] leading-relaxed text-[#0a0e0c]">{m.text}</div>
              ) : (
                <div className="w-full max-w-4xl rounded-xl rounded-bl-sm border border-[var(--line)] bg-[var(--surface)] px-5 py-4 md:px-6" style={{ borderTop: "1px solid var(--moss)" }}>
                  <ReactMarkdown components={mdComponents}>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="mx-auto flex w-full max-w-5xl justify-start">
              <div className="flex gap-1.5 rounded-2xl rounded-bl-sm border border-line bg-[var(--surface)] px-4 py-3.5">
                {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line px-4 py-4 md:px-8 md:py-5">
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy} className="shrink-0 rounded-full border border-line px-3.5 py-2 text-[13px] text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] hover:text-bone disabled:opacity-40">{s}</button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-3 rounded-full border border-line bg-[var(--surface)] p-1.5 pl-4 focus-within:border-[var(--moss)]">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe what you want to improve..." className="min-w-0 flex-1 bg-transparent text-[15px] text-bone outline-none placeholder:text-[var(--muted)]" aria-label="Message the concierge" />
              <button type="submit" disabled={busy || !input.trim()} className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c] transition-opacity hover:opacity-90 disabled:opacity-30">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { apiUrl } from "../lib/api";
import { readChatStream } from "../lib/chat-stream";

type Msg = { role: "user" | "bot"; text: string; failed?: boolean };
type ApiMsg = { role: "human" | "ai"; content: string };

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2.5 text-[14px] leading-6 text-[var(--bone-dim)] last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mb-4 text-xl font-semibold text-bone">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold text-bone first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold text-bone first:mt-0">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--accent)] not-italic">{children}</strong>,
  em: ({ children }) => <em className="not-italic text-[var(--bone-dim)]">{children}</em>,
  ul: ({ children }) => <ul className="my-3 grid list-none gap-2 pl-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 grid list-none gap-2 pl-0">{children}</ol>,
  li: ({ children }) => (
    <li className="border-l border-[var(--moss)] py-1 pl-3 text-[14px] leading-6 text-[var(--bone-dim)] [&>p]:mb-1 [&>p:last-child]:mb-0">
      {children}
    </li>
  ),
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-accent pl-4 text-[var(--bone-dim)]">{children}</blockquote>,
  hr: () => <hr className="my-5 border-0 border-t border-[var(--line)]" />,
  code: ({ children }) => <code className="rounded bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--bone-dim)]">{children}</code>,
};

const GREETING = "I'm Vera, your Meridian health concierge. Tell me what you're optimizing for and I'll point you to the right protocol.";

export default function Chatbot() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", text: msg }];
    setMessages(next);
    setBusy(true);
    const updateAnswer = (text: string, failed = false) => {
      setMessages([...next, { role: "bot", text, failed }]);
    };
    try {
      const history: ApiMsg[] = next
        .filter((m) => !m.failed && m.text && (m.role !== "bot" || m.text !== GREETING))
        .map((m) => ({ role: m.role === "user" ? "human" : "ai", content: m.text }));
      const res = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่");
      }
      if (res.headers.get("content-type")?.includes("application/x-ndjson")) {
        if (!res.body) throw new Error("ไม่สามารถรับคำตอบได้ กรุณาลองใหม่");
        await readChatStream(res.body, updateAnswer);
      } else {
        const data = await res.json();
        updateAnswer(data.response ?? "ไม่สามารถรับคำตอบได้ กรุณาลองใหม่");
      }
    } catch (error) {
      if (!controller.signal.aborted) updateAnswer(error instanceof Error ? error.message : "การเชื่อมต่อขัดข้อง กรุณาลองใหม่", true);
    } finally {
      activeRequest.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[var(--bg-deep,#070a08)]">
      <div className="flex h-[clamp(960px,82vh,960px)] flex-col">
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
          {messages.map((m, i) => m.text && (
            <div key={i} className={`mx-auto flex w-full max-w-5xl ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "user" ? (
                <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-[14px] leading-relaxed text-[#0a0e0c]">{m.text}</div>
              ) : (
                <div className="flex w-full max-w-5xl items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--moss)] bg-[var(--surface)] font-mono text-[11px] font-semibold text-accent">
                    V
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-bone">Vera</span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Concierge</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-[var(--line)] bg-[var(--surface)] px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] md:px-6 md:py-5">
                      <ReactMarkdown components={mdComponents}>{m.text}</ReactMarkdown>
                    </div>
                  </div>
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

"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";

type ChatRow = {
  message_id: number;
  session_id: string;
  human_message: string;
  ai_message: string;
  sentiment: string;
  intent_name: string;
  intent_score: number;
  ai_confident: number;
  created_at: string;
  used_tools: string;
};

const LIMIT = 20;

const sentimentColor: Record<string, string> = {
  positive: "text-accent",
  neutral: "text-[var(--bone-dim)]",
  negative: "text-[#e0a0a0]",
};

export default function ChatLogsPage() {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "-");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/admin/chat-log?page=${page}&limit=${LIMIT}`), {
          cache: "no-store",
          credentials: "include",
        });
        const d = await res.json();
        if (cancelled) return;
        setRows(Array.isArray(d.items) ? d.items : []);
        setTotal(Number.isFinite(d.total) ? d.total : 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">/ concierge</span>
          <h1 className="display mt-3 text-4xl text-bone">Chat Logs</h1>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">{total} messages</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)]">
              <tr className="[&>th]:px-4 [&>th]:py-3.5 [&>th]:font-mono [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-widest [&>th]:whitespace-nowrap">
                <th>Msg</th>
                <th>Session</th>
                <th>Human</th>
                <th>AI</th>
                <th>Sentiment</th>
                <th>Intent</th>
                <th>Score</th>
                <th>Conf.</th>
                <th>Tool</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[var(--muted)]">
                    Loading...
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.message_id} className="bg-[var(--surface)] align-top [&>td]:px-4 [&>td]:py-3.5">
                    <td className="font-mono text-xs text-[var(--muted)]">{t.message_id}</td>
                    <td className="font-mono text-xs text-accent">{t.session_id}</td>
                    <td className="max-w-[220px] text-[var(--bone-dim)]">{t.human_message}</td>
                    <td className="max-w-[260px] text-bone">{t.ai_message}</td>
                    <td className={sentimentColor[t.sentiment] || "text-[var(--bone-dim)]"}>
                      {t.sentiment}
                    </td>
                    <td className="whitespace-nowrap text-[var(--bone-dim)]">{t.intent_name}</td>
                    <td className="text-[var(--bone-dim)]">{f2(t.intent_score)}</td>
                    <td className="text-[var(--bone-dim)]">{f2(t.ai_confident)}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-[var(--muted)]">
                      {t.used_tools}
                    </td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {new Date(t.created_at).toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] disabled:opacity-30"
        >
          Previous
        </button>
        <span className="font-mono text-xs text-[var(--muted)]">
          Page {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}

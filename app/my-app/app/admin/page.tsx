"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

type Metrics = {
  order: { complete_rate: number; intent_sessions: number; ai_create_order: number };
  handoff: { total_sessions: number; handoff_sessions: number; handoff_rate: number };
  ai: { ai_message_count: number; avg_ai_confident: number };
  session: {
    session_used: number;
    avg_message_count: number;
    avg_session_duration_sec: number;
    avg_session_duration_min: number;
  };
  keytop: { a_topic: string[]; a_key: string[] };
  catalog: { total_products: number; low_stock: number };
};

function Card({
  title,
  children,
  span,
}: {
  title: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <section
      className={
        "rounded-2xl border border-line bg-[var(--surface)] p-6 " +
        (span ? "md:col-span-2" : "")
      }
    >
      <h2 className="text-sm font-medium text-[var(--bone-dim)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="display text-bone" style={{ fontSize: "clamp(2.2rem,4vw,3rem)" }}>
        {value}
      </div>
      <div className="mt-1 text-[13px] text-[var(--muted)]">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (start) q.set("start_date", start);
      if (end) q.set("end_date", end);
      const res = await fetch(apiUrl("/admin/metrics?" + q.toString()), {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setM(await res.json());
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <span className="eyebrow">/ overview</span>
          <h1 className="display mt-3 text-4xl text-bone">Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Start</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-lg border border-line bg-[var(--surface)] px-3 py-2 text-sm text-bone outline-none focus:border-[var(--moss)] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">End</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-lg border border-line bg-[var(--surface)] px-3 py-2 text-sm text-bone outline-none focus:border-[var(--moss)] [color-scheme:dark]"
            />
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0a0e0c] disabled:opacity-40"
          >
            {loading ? "Loading..." : "Apply"}
          </button>
          <button
            onClick={() => {
              setStart("");
              setEnd("");
            }}
            className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] hover:border-[var(--moss)]"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-lg border border-[#5a2b2b] bg-[#1c1212] px-4 py-3 text-sm text-[#e6a8a8]">
          {error}
        </p>
      )}

      {!m ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-line bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card title="อัตราการขายสำเร็จ">
            <Big value={`${m.order.complete_rate}%`} label="Completion rate" />
            <div className="mt-5 flex gap-8 text-sm">
              <div>
                <div className="text-bone">{m.order.intent_sessions}</div>
                <div className="text-[var(--muted)]">Order-intent sessions</div>
              </div>
              <div>
                <div className="text-bone">{m.order.ai_create_order}</div>
                <div className="text-[var(--muted)]">AI create_order</div>
              </div>
            </div>
          </Card>

          <Card title="อัตราการส่งต่อเจ้าหน้าที่">
            <Big value={`${m.handoff.handoff_rate}%`} label="Handoff rate" />
            <div className="mt-5 flex gap-8 text-sm">
              <div>
                <div className="text-bone">{m.handoff.total_sessions}</div>
                <div className="text-[var(--muted)]">All sessions</div>
              </div>
              <div>
                <div className="text-bone">{m.handoff.handoff_sessions}</div>
                <div className="text-[var(--muted)]">Handed off</div>
              </div>
            </div>
          </Card>

          <Card title="อัตราการตอบสำเร็จ">
            <Big value={`${(100 - m.handoff.handoff_rate).toFixed(2)}%`} label="Resolved by AI" />
            <div className="mt-5 text-sm">
              <div className="text-bone">{m.handoff.total_sessions} sessions</div>
              <div className="text-[var(--muted)]">
                {m.handoff.handoff_rate}% referred to a clinician
              </div>
            </div>
          </Card>

          <Card title="Average AI Confidence">
            <Big value={`${m.ai.avg_ai_confident}%`} label={`Across ${m.ai.ai_message_count} AI messages`} />
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${m.ai.avg_ai_confident}%` }}
              />
            </div>
          </Card>

          <Card title="Keyword & Topic" span>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-3">Top topics</div>
                <ol className="space-y-2">
                  {m.keytop.a_topic.map((t, i) => (
                    <li key={t} className="flex items-center gap-3 text-sm text-bone">
                      <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="eyebrow mb-3">Top keywords</div>
                <div className="flex flex-wrap gap-2">
                  {m.keytop.a_key.map((k) => (
                    <span
                      key={k}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-[var(--bone-dim)]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Average Session Time">
            <div className="grid grid-cols-2 gap-5">
              <Big value={`${m.session.session_used}`} label="Sessions" />
              <Big value={`${m.session.avg_message_count}`} label="Msgs / session" />
              <Big value={`${m.session.avg_session_duration_sec}s`} label="Avg duration" />
              <Big value={`${m.session.avg_session_duration_min}m`} label="Avg minutes" />
            </div>
          </Card>

          <Card title="Catalog">
            <div className="flex gap-10">
              <Big value={`${m.catalog.total_products}`} label="Products" />
              <Big value={`${m.catalog.low_stock}`} label="Low stock (<100)" />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

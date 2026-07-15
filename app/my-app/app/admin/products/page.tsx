"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";

type Product = {
  code: string;
  name: string;
  name_eng: string;
  cost: number;
  stock_qty: number;
  brand: string;
  category: string;
  detail: string;
  created_at: string;
};

type PageMeta = { total: number; page: number; pages: number };

const EMPTY = {
  name: "",
  name_eng: "",
  cost: "",
  stock_qty: "",
  brand: "Meridian",
  category: "Foundation",
  detail: "",
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/admin/products?page=${page}`), {
        cache: "no-store",
        credentials: "include",
      });
      const d = await res.json();
      setItems(Array.isArray(d.items) ? d.items : []);
      setMeta({ total: d.total ?? 0, page: d.page ?? page, pages: d.pages ?? 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/admin/products"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to add");
      }
      const product = await res.json();
      setForm(EMPTY);
      setOpen(false);
      await load(1);
      if (window.confirm("Product saved. Update Vera AI now?")) {
        const sync = await fetch(apiUrl(`/admin/products/${product.code}/sync`), {
          method: "POST",
          credentials: "include",
        });
        if (!sync.ok) throw new Error("Product saved, but Vera update failed");
        window.alert("Vera AI updated");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const syncAll = async () => {
    if (!window.confirm("Update all products for Vera AI now?")) return;
    setSyncBusy(true);
    setErr("");
    try {
      const res = await fetch(apiUrl("/admin/products/sync"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Vera update failed");
      }
      const data = await res.json();
      window.alert(`Vera AI updated with ${data.count} products`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Vera update failed");
    } finally {
      setSyncBusy(false);
    }
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const field =
    "w-full rounded-lg border border-line bg-[var(--bg)] px-3 py-2.5 text-sm text-bone outline-none focus:border-[var(--moss)] placeholder:text-[var(--muted)]";

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">/ catalog</span>
          <h1 className="display mt-3 text-4xl text-bone">Products</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncAll}
            disabled={syncBusy}
            className="rounded-full border border-line px-5 py-2.5 text-sm text-[var(--bone-dim)] disabled:opacity-40"
          >
            {syncBusy ? "Updating Vera..." : "Update products for Vera"}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c]"
          >
            {open ? "Close" : "Add product"}
          </button>
        </div>
      </div>

      {err && <p className="mb-5 text-sm text-[#e6a8a8]">{err}</p>}

      {open && (
        <form
          onSubmit={submit}
          className="mb-8 rounded-2xl border border-line bg-[var(--surface)] p-6"
        >
          <h2 className="text-sm font-medium text-[var(--bone-dim)]">New product</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="eyebrow">Name (Thai)</span>
              <input className={field} value={form.name} onChange={set("name")} required />
            </label>
            <label className="space-y-1.5">
              <span className="eyebrow">Name (Eng)</span>
              <input className={field} value={form.name_eng} onChange={set("name_eng")} required />
            </label>
            <label className="space-y-1.5">
              <span className="eyebrow">Price ($)</span>
              <input type="number" min="0" step="0.01" className={field} value={form.cost} onChange={set("cost")} required />
            </label>
            <label className="space-y-1.5">
              <span className="eyebrow">Stock qty</span>
              <input type="number" min="0" className={field} value={form.stock_qty} onChange={set("stock_qty")} required />
            </label>
            <label className="space-y-1.5">
              <span className="eyebrow">Brand</span>
              <input className={field} value={form.brand} onChange={set("brand")} />
            </label>
            <label className="space-y-1.5">
              <span className="eyebrow">Category</span>
              <input className={field} value={form.category} onChange={set("category")} />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="eyebrow">Detail</span>
              <textarea rows={2} className={field} value={form.detail} onChange={set("detail")} />
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c] disabled:opacity-40"
            >
              {busy ? "Adding..." : "Add product"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY);
                setOpen(false);
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-[var(--bone-dim)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)]">
              <tr className="[&>th]:px-5 [&>th]:py-3.5 [&>th]:font-mono [&>th]:text-[11px] [&>th]:uppercase [&>th]:tracking-widest">
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[var(--muted)]">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[var(--muted)]">
                    No products yet.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.code} className="bg-[var(--surface)] [&>td]:px-5 [&>td]:py-4">
                    <td className="font-mono text-xs text-accent">{p.code}</td>
                    <td>
                      <div className="text-bone">{p.name_eng}</div>
                      <div className="text-[var(--muted)]">{p.name}</div>
                    </td>
                    <td className="text-[var(--bone-dim)]">{p.category}</td>
                    <td className="text-bone">${p.cost}</td>
                    <td>
                      <span
                        className={
                          p.stock_qty < 100 ? "text-[#e0b072]" : "text-[var(--bone-dim)]"
                        }
                      >
                        {p.stock_qty}
                      </span>
                    </td>
                    <td className="text-[var(--muted)]">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("th-TH") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {meta.pages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-[var(--muted)]">
            {meta.total} products — page {meta.page} of {meta.pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => load(meta.page - 1)}
              disabled={meta.page <= 1 || loading}
              className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] disabled:opacity-30"
            >
              Prev
            </button>
            {Array.from({ length: meta.pages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === meta.pages || Math.abs(p - meta.page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-1 py-2 text-sm text-[var(--muted)]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => load(p as number)}
                    disabled={loading}
                    className={
                      "rounded-lg border px-3.5 py-2 text-sm transition-colors disabled:opacity-30 " +
                      (p === meta.page
                        ? "border-[var(--moss)] bg-[var(--surface-2)] text-bone"
                        : "border-line text-[var(--bone-dim)] hover:border-[var(--moss)]")
                    }
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => load(meta.page + 1)}
              disabled={meta.page >= meta.pages || loading}
              className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

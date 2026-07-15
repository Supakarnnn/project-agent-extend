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
  sync_status: "pending" | "syncing" | "synced" | "failed";
  synced_at: string | null;
};

type PageMeta = { total: number; page: number; pages: number };
type VeraModal =
  | { state: "confirm"; scope: "one" | "all"; code?: string }
  | { state: "loading"; scope: "one" | "all" }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

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
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [veraModal, setVeraModal] = useState<VeraModal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async (page = 1, term = appliedSearch) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (term.trim()) query.set("search", term.trim());
      const res = await fetch(apiUrl(`/admin/products?${query}`), {
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
    load(1, "");
  }, []);

  useEffect(() => {
    if (!veraModal || veraModal.state === "loading") return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setVeraModal(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [veraModal]);

  useEffect(() => {
    if (!deleteTarget || deleteBusy) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDeleteTarget(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [deleteTarget, deleteBusy]);

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
      await load(1, appliedSearch);
      setVeraModal({ state: "confirm", scope: "one", code: product.code });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const syncVera = async (scope: "one" | "all", code?: string) => {
    setSyncBusy(true);
    setErr("");
    setVeraModal({ state: "loading", scope });
    try {
      const path = scope === "all" ? "/admin/products/sync" : `/admin/products/${code}/sync`;
      const res = await fetch(apiUrl(path), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Vera update failed");
      }
      const data = await res.json();
      await load(meta.page, appliedSearch);
      setVeraModal({
        state: "success",
        message: scope === "all" ? `${data.count} products are ready for Vera.` : "Product is ready for Vera.",
      });
    } catch (e) {
      setVeraModal({
        state: "error",
        message: e instanceof Error ? e.message : "Vera update failed",
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const deleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(apiUrl(`/admin/products/${deleteTarget.code}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Delete failed");
      }
      setDeleteTarget(null);
      await load(items.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page, appliedSearch);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
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
            onClick={() => setVeraModal({ state: "confirm", scope: "all" })}
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const term = search.trim();
          setAppliedSearch(term);
          load(1, term);
        }}
        role="search"
        className="mb-6 flex max-w-xl gap-2"
      >
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <input
          id="product-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code, name, brand, or category"
          className="min-w-0 flex-1 rounded-lg border border-line bg-[var(--surface)] px-4 py-2.5 text-sm text-bone outline-none placeholder:text-[var(--muted)] focus:border-[var(--moss)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c] hover:bg-[var(--accent-press)] disabled:opacity-40"
        >
          Search
        </button>
      </form>

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
                <th>Vera</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[var(--muted)]">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[var(--muted)]">
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
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase ${
                          p.sync_status === "synced"
                            ? "bg-[var(--surface-2)] text-accent"
                            : p.sync_status === "failed"
                              ? "bg-[#291919] text-[#e6a8a8]"
                              : "bg-[var(--bg)] text-[var(--muted)]"
                        }`}
                      >
                        {p.sync_status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="rounded-full border border-[#5a2b2b] px-3.5 py-1.5 text-xs text-[#e6a8a8] hover:bg-[#291919]"
                      >
                        Delete
                      </button>
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
              onClick={() => load(meta.page - 1, appliedSearch)}
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
                    onClick={() => load(p as number, appliedSearch)}
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
              onClick={() => load(meta.page + 1, appliedSearch)}
              disabled={meta.page >= meta.pages || loading}
              className="rounded-lg border border-line px-4 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {veraModal && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/75 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vera-modal-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--moss)] bg-[var(--surface)]">
            <div className="h-1 bg-accent" />
            <div className="p-7 sm:p-8">
              {veraModal.state === "confirm" && (
                <>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-xl text-accent">
                    V
                  </div>
                  <h2 id="vera-modal-title" className="text-xl font-medium text-bone">
                    Update Vera AI?
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--bone-dim)]">
                    {veraModal.scope === "all"
                      ? "Vera will rebuild embeddings from every active product in Supabase."
                      : "Product saved in Supabase. Vera can learn this product now, or wait for the scheduled update."}
                  </p>
                  <div className="mt-7 flex justify-end gap-3">
                    <button
                      onClick={() => setVeraModal(null)}
                      className="rounded-full border border-line px-5 py-2.5 text-sm text-[var(--bone-dim)] hover:border-[var(--moss)] hover:text-bone"
                    >
                      Not now
                    </button>
                    <button
                      autoFocus
                      onClick={() => syncVera(veraModal.scope, veraModal.code)}
                      className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c] hover:bg-[var(--accent-press)]"
                    >
                      Update Vera
                    </button>
                  </div>
                </>
              )}

              {veraModal.state === "loading" && (
                <div className="py-5 text-center" aria-live="polite">
                  <div className="relative mx-auto h-16 w-16">
                    <div className="absolute inset-0 rounded-full border border-[var(--moss)]" />
                    <div className="motion-safe:animate-spin absolute inset-0 rounded-full border-2 border-transparent border-t-accent" />
                    <span className="absolute inset-0 grid place-items-center font-mono text-sm text-accent">V</span>
                  </div>
                  <h2 id="vera-modal-title" className="mt-6 text-xl font-medium text-bone">
                    Preparing Vera
                  </h2>
                  <p className="mt-2 text-sm text-[var(--bone-dim)]">
                    Creating embeddings and updating Milvus. Keep this window open.
                  </p>
                  <div className="mt-7 h-1 overflow-hidden rounded-full bg-[var(--bg)]">
                    <div className="h-full w-2/3 motion-safe:animate-pulse rounded-full bg-accent" />
                  </div>
                </div>
              )}

              {(veraModal.state === "success" || veraModal.state === "error") && (
                <div aria-live="polite">
                  <div
                    className={`mb-6 flex h-12 w-12 items-center justify-center rounded-full text-xl ${
                      veraModal.state === "success"
                        ? "bg-[var(--surface-2)] text-accent"
                        : "bg-[#291919] text-[#e6a8a8]"
                    }`}
                  >
                    {veraModal.state === "success" ? "✓" : "!"}
                  </div>
                  <h2 id="vera-modal-title" className="text-xl font-medium text-bone">
                    {veraModal.state === "success" ? "Vera is up to date" : "Update failed"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--bone-dim)]">{veraModal.message}</p>
                  <div className="mt-7 flex justify-end">
                    <button
                      autoFocus
                      onClick={() => setVeraModal(null)}
                      className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#0a0e0c] hover:bg-[var(--accent-press)]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/75 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#5a2b2b] bg-[var(--surface)]">
            <div className="h-1 bg-[#bd6262]" />
            <div className="p-7 sm:p-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#291919] text-xl text-[#e6a8a8]">
                !
              </div>
              <h2 id="delete-modal-title" className="text-xl font-medium text-bone">
                Delete product?
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--bone-dim)]">
                <strong className="font-medium text-bone">{deleteTarget.name_eng || deleteTarget.name}</strong>{" "}
                will be permanently removed from Supabase. Milvus stays unchanged until next Vera update.
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteBusy}
                  className="rounded-full border border-line px-5 py-2.5 text-sm text-[var(--bone-dim)] hover:border-[var(--moss)] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  autoFocus
                  onClick={deleteProduct}
                  disabled={deleteBusy}
                  className="rounded-full bg-[#bd6262] px-5 py-2.5 text-sm font-medium text-[#160b0b] disabled:opacity-40"
                >
                  {deleteBusy ? "Deleting..." : "Delete product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

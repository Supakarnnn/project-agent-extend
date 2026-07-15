"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiUrl } from "../../lib/api";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/chat-logs", label: "Chat Logs" },
];

export default function Shell({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" });
    router.replace("/admin/login");
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-line bg-[var(--surface)] p-6 md:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rotate-45 bg-accent" />
            <span className="text-[15px] font-medium tracking-tight">Meridian</span>
            <span className="ml-1 rounded border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--muted)]">
              admin
            </span>
          </div>

          <nav className="mt-10 flex flex-col gap-1">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    "rounded-lg px-3 py-2.5 text-sm transition-colors " +
                    (active
                      ? "bg-[var(--surface-2)] text-bone"
                      : "text-[var(--bone-dim)] hover:bg-[var(--surface-2)] hover:text-bone")
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={
                        "h-1.5 w-1.5 rotate-45 " + (active ? "bg-accent" : "bg-[var(--moss)]")
                      }
                    />
                    {n.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-line pt-5">
          <p className="font-mono text-[11px] text-[var(--muted)]">Signed in</p>
          <p className="mt-1 text-sm text-bone">{name}</p>
          <button
            onClick={logout}
            className="mt-4 w-full rounded-lg border border-line px-3 py-2 text-sm text-[var(--bone-dim)] transition-colors hover:border-[var(--moss)] hover:text-bone"
          >
            Log out
          </button>
          <Link
            href="/"
            className="mt-2 block text-center font-mono text-[11px] text-[var(--muted)] transition-colors hover:text-bone"
          >
            View storefront
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-line bg-[var(--surface)] px-5 py-4 md:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rotate-45 bg-accent" />
            <span className="text-sm font-medium">Meridian admin</span>
          </div>
          <button onClick={logout} className="font-mono text-xs text-[var(--bone-dim)]">
            Log out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-[var(--surface)] px-3 py-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm " +
                (pathname === n.href ? "bg-[var(--surface-2)] text-bone" : "text-[var(--bone-dim)]")
              }
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}

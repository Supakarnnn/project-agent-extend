"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Shell from "./_components/Shell";
import { apiUrl } from "../lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [state, setState] = useState<"checking" | "ok" | "out">("checking");
  const [name, setName] = useState("admin");

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/auth/check"), {
          cache: "no-store",
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          const d = await res.json();
          setName(d.name);
          setState("ok");
        } else {
          setState("out");
          router.replace("/admin/login");
        }
      } catch {
        if (!cancelled) {
          setState("out");
          router.replace("/admin/login");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;

  if (state !== "ok") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
        <span className="eyebrow animate-pulse">Checking session</span>
      </div>
    );
  }

  return (
    <Shell name={name}>{children}</Shell>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { NavigationBreadcrumbs } from "@/components/navigation/navigation-breadcrumbs";

export function JourneyScreen({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <main className="px-1 py-6 text-white sm:px-2">
      <NavigationBreadcrumbs pathname={pathname} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stocklana-blue">{kicker}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stocklana-muted">{lede}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </main>
  );
}

export function JourneyNotice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-amber-700/70 bg-amber-950/30 p-4 text-sm leading-6 text-amber-100" role="status">{children}</p>;
}

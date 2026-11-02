"use client";

import Link from "next/link";

export function NavigationItem({
  href,
  label,
  current,
  collapsed = false,
}: {
  href: string;
  label: string;
  current: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      title={label}
      className={
        "flex min-h-11 items-center rounded-lg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70 " +
        (current ? "bg-white/10 font-semibold text-white" : "text-stocklana-muted hover:bg-white/5 hover:text-white")
      }
    >
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
      {collapsed ? <span aria-hidden="true">{label.slice(0, 1)}</span> : null}
    </Link>
  );
}

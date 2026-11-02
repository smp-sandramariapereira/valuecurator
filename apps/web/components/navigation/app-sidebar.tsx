"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT_LINKS, PRODUCT_NAVIGATION, activeNavigationItem } from "@/lib/product-navigation";
import { NavigationGroup } from "@/components/navigation/navigation-group";

export function AppSidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeId = activeNavigationItem(pathname)?.id ?? null;
  return (
    <nav
      aria-label="Jornada"
      className={collapsed ? "w-16" : "w-64"}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) onNavigate?.();
      }}
    >
      <div className="space-y-1">
        {PRODUCT_NAVIGATION.map((group) => (
          <NavigationGroup key={group.id} group={group} pathname={pathname} activeId={activeId} collapsed={collapsed} />
        ))}
      </div>
      <div className="mt-6 border-t border-stocklana-border pt-3">
        <p className={collapsed ? "sr-only" : "px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-stocklana-muted"}>Conta</p>
        {ACCOUNT_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-11 items-center rounded-lg px-3 text-sm text-stocklana-muted hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70"
          >
            <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
            {collapsed ? <span aria-hidden="true">{link.label.slice(0, 1)}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

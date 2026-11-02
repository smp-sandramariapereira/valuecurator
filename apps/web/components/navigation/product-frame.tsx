"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { NavigationMobile } from "@/components/navigation/navigation-mobile";
import { isProductPath } from "@/lib/product-navigation";

export function ProductFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  if (!isProductPath(pathname)) return <>{children}</>;
  return (
    <div className="mx-auto flex max-w-[90rem] items-start gap-4 px-3 pb-16 sm:px-4">
      <div className="sticky top-4 hidden shrink-0 py-4 lg:block">
        <button
          type="button"
          className="mb-3 min-h-11 rounded-lg px-3 text-xs text-stocklana-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70 hover:text-white"
          aria-expanded={!collapsed}
          aria-controls="product-sidebar"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Expandir menu" : "Recolher menu"}
        </button>
        <div id="product-sidebar">
          <AppSidebar collapsed={collapsed} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="py-3 lg:hidden">
          <button
            type="button"
            className="min-h-11 rounded-xl border border-stocklana-border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70"
            aria-expanded={open}
            aria-controls="product-drawer"
            onClick={() => setOpen(true)}
          >
            Abrir navegação
          </button>
        </div>
        <div id="product-drawer">
          <NavigationMobile open={open} onClose={() => setOpen(false)} />
        </div>
        {children}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import type { ProductNavGroup } from "@/lib/product-navigation";
import { NavigationItem } from "@/components/navigation/navigation-item";

export function NavigationGroup({
  group,
  pathname,
  activeId,
  collapsed = false,
}: {
  group: ProductNavGroup;
  pathname: string;
  activeId: string | null;
  collapsed?: boolean;
}) {
  const panelId = useId();
  const containsCurrent = group.items.some((item) => item.id === activeId);
  const [open, setOpen] = useState(containsCurrent || group.items.length === 1);
  useEffect(() => {
    if (containsCurrent) setOpen(true);
  }, [containsCurrent]);
  if (group.items.length === 1) {
    const item = group.items[0];
    return <NavigationItem href={item.href} label={group.label} current={pathname === item.href} collapsed={collapsed} />;
  }
  return (
    <div>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70 hover:bg-white/5"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={collapsed ? "sr-only" : ""}>{group.label}</span>
        {collapsed ? <span aria-hidden="true">{group.label.slice(0, 1)}</span> : null}
        <span aria-hidden="true" className={collapsed ? "sr-only" : "text-stocklana-muted"}>{open ? "–" : "+"}</span>
      </button>
      {open ? (
        <div id={panelId} className={collapsed ? "space-y-1" : "space-y-1 pl-2"}>
          {group.items.map((item) => (
            <NavigationItem key={item.id} href={item.href} label={item.label} current={item.id === activeId} collapsed={collapsed} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

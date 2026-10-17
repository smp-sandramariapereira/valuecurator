"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeButton } from "@/components/home-button";
import { NAV_LINKS } from "@/lib/institutional";
import { version } from "../../package.json";

const INFO_PREFIXES = ["/about", "/technology", "/solutions", "/journey", "/team", "/roadmap", "/partners", "/pitchdeck"];

export function SiteHeader() {
  const pathname = usePathname();
  const onInformation = INFO_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return (
    <header className={onInformation ? "institutional-shell px-4 pt-4 sm:px-6 lg:px-8" : "px-4 pt-4 sm:px-6 lg:px-8"}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <HomeButton />
          <div className="flex items-center gap-4">
            {onInformation ? null : (
              <Link
                href="/about"
                className="institutional-link inline-flex h-11 items-center rounded-xl border border-institutional-emerald/70 bg-institutional-emerald/15 px-4 text-sm font-semibold text-institutional-emerald hover:bg-institutional-emerald hover:text-institutional-ink"
              >
                About
              </Link>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stocklana-muted">{version}</p>
          </div>
        </div>
        {onInformation ? (
          <nav aria-label="Information" className="flex flex-wrap gap-2">
            {NAV_LINKS.map((link) => {
              const current = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={
                    "institutional-link rounded-lg px-3 py-2 text-sm transition " +
                    (current ? "bg-white/10 text-white" : "text-stocklana-muted hover:bg-white/5 hover:text-white")
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </header>
  );
}

import Link from "next/link";

const SHORTCUTS = [
  { href: "/portfolio", label: "Portfólio" },
  { href: "/assets", label: "Ativos" },
  { href: "/proofgate", label: "Propostas" },
  { href: "/activity", label: "Atividade" },
] as const;

export function JourneyShortcuts() {
  return (
    <nav aria-label="Atalhos da jornada" className="flex flex-wrap gap-2">
      {SHORTCUTS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-11 items-center rounded-xl border border-stocklana-border px-4 text-sm text-stocklana-muted hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

import Link from "next/link";
import { InstitutionalFrame } from "@/components/institutional/institutional-ui";
import { CONTACT_EMAIL, NAV_LINKS } from "@/lib/institutional";
import { version } from "../../package.json";

const summaries: Record<string, string> = {
  "/technology": "KAIROS Engine, the Discovery API, market evidence and the Devnet program.",
  "/solutions": "Sectors and offerings, each labeled by what the repository contains today.",
  "/journey": "KAIROS Engine, StockLana, the World Fair and the current RWA direction.",
  "/team": "Sandra and João, with associates A. and H.",
  "/roadmap": "Implemented, in development and planned. No delivery dates.",
  "/partners": "How to write to the team. Superteam Brasil is an invitation, not an official partnership.",
};

export function AboutIndex() {
  const entries = NAV_LINKS.filter((link) => link.href !== "/about");
  return (
    <InstitutionalFrame>
      <section className="about-terminal" aria-label="About">
        <div className="flex items-center gap-2 border-b border-institutional-emerald/30 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-institutional-emerald" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-institutional-cyan/70" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" aria-hidden="true" />
          <p className="ml-2 text-[11px] tracking-wide text-institutional-cyan">valuecurator — about — {version}</p>
        </div>
        <div className="space-y-5 px-4 py-5 text-sm leading-6 sm:px-6">
          <p>
            <span className="text-institutional-emerald" aria-hidden="true">$ </span>
            <span className="text-white">about</span>
          </p>
          <h1 className="text-base font-medium text-white sm:text-lg">Information sits beside the application.</h1>
          <p className="text-institutional-cyan/90">
            # The home page is the working panel: mandate, gate, audit, wallet and the Devnet demonstration.
            <br />
            # The paths below explain the technology, the team and the direction.
          </p>
          <p>
            <span className="text-institutional-emerald" aria-hidden="true">$ </span>
            <span className="text-white">ls</span>
          </p>
          <ul className="space-y-3">
            {entries.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="institutional-link group grid gap-1 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
                  <span className="text-institutional-emerald group-hover:text-white">{link.label.toLowerCase()}/</span>
                  <span className="text-stocklana-muted group-hover:text-institutional-cyan">{summaries[link.href]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <span className="text-institutional-emerald" aria-hidden="true">$ </span>
            <span className="text-white">contact</span>{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="institutional-link text-institutional-cyan underline decoration-institutional-emerald/40 underline-offset-4 hover:text-white">
              {CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-institutional-emerald">
            <span aria-hidden="true">$ </span>
            <span className="sr-only">Ready</span>
            <span className="about-cursor" aria-hidden="true" />
          </p>
        </div>
      </section>
    </InstitutionalFrame>
  );
}

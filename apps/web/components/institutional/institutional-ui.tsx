import type { ReactNode } from "react";
import Link from "next/link";
import { CONTACT_EMAIL, GITHUB_URL, MATURITY_LABEL, NAV_LINKS, type Maturity } from "@/lib/institutional";

export function StatusLabel({ maturity }: { maturity: Maturity }) {
  const tone =
    maturity === "implemented"
      ? "border-institutional-emerald/40 text-institutional-emerald"
      : maturity === "development"
        ? "border-institutional-cyan/40 text-institutional-cyan"
        : "border-stocklana-border text-stocklana-muted";
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}>
      {MATURITY_LABEL[maturity]}
    </span>
  );
}

export function InstitutionalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-10 sm:px-6">
      {children}
      <SiteFooter />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-institutional-cyan">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{title}</h2>
      <p className="text-sm leading-6 text-stocklana-muted">{body}</p>
    </div>
  );
}

export function InfoCard({
  title,
  body,
  maturity,
}: {
  title: string;
  body: string;
  maturity: Maturity;
}) {
  return (
    <article className="institutional-panel flex h-full flex-col gap-4 rounded-2xl border p-5">
      <StatusLabel maturity={maturity} />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-6 text-stocklana-muted">{body}</p>
    </article>
  );
}

export function FlowDiagram({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flow-diagram" aria-label="From asset data to an auditable result">
      {steps.map((step, index) => (
        <li key={step} className="flow-step">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-institutional-emerald">
            {String(index + 1).padStart(2, "0")}
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{step}</p>
        </li>
      ))}
    </ol>
  );
}

export function SiteFooter() {
  return (
    <footer className="space-y-6 border-t border-stocklana-border pt-8 text-sm text-stocklana-muted">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-semibold text-white">ValueCurator</p>
          <p>AI-powered financial infrastructure</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="institutional-link hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2">
          <a href={`mailto:${CONTACT_EMAIL}`} className="institutional-link text-institutional-cyan hover:text-white">
            {CONTACT_EMAIL}
          </a>
          <a href={GITHUB_URL} className="institutional-link text-institutional-cyan hover:text-white">
            GitHub
          </a>
        </div>
      </div>
      <p className="max-w-3xl text-xs leading-5">
        ValueCurator develops financial technology infrastructure. Information presented on this website does not constitute financial advice or a guarantee of investment performance.
      </p>
    </footer>
  );
}

import type { Metadata } from "next";
import { InstitutionalFrame, SectionTitle } from "@/components/institutional/institutional-ui";
import { KAIROS_HISTORY_URL, GITHUB_URL } from "@/lib/institutional";

export const metadata: Metadata = {
  title: "Journey · ValueCurator",
  description: "How ValueCurator grew from KAIROS Engine through StockLana and the World Fair.",
};

const milestones = [
  {
    title: "KAIROS Engine",
    body: "The early program established the node, token custody and owner control on Solana. The historical repository remains a reference. This page does not treat its latest commit as the StockLana submission.",
    href: KAIROS_HISTORY_URL,
    label: "Historical repository",
  },
  {
    title: "StockLana",
    body: "The team took part in the StockLana hackathon. The demonstration added market evidence, risk limits and authorization checks around a documented AAPLx read. That read is not a mainnet purchase.",
  },
  {
    title: "World Fair",
    body: "The project entered the Colosseum Crypto World’s Fair as ValueCurator. The public application, the discovery service and the Devnet evidence were brought into this repository. Participation is not a prize.",
  },
  {
    title: "RWA expansion",
    body: "The current direction is intelligent infrastructure for more tokenized assets. The running demonstration still centers on one asset and one Devnet mint.",
  },
];

export default function JourneyPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Journey"
        title="From research to financial infrastructure."
        body="The sequence is the project’s own record. Where a submission boundary is not in this repository, the text does not invent one."
      />
      <ol className="space-y-4">
        {milestones.map((item, index) => (
          <li key={item.title} className="institutional-panel rounded-2xl border p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-institutional-emerald">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stocklana-muted">{item.body}</p>
            {item.href ? (
              <a href={item.href} className="institutional-link mt-4 inline-flex text-sm font-semibold text-institutional-cyan">
                {item.label}
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      <a href={GITHUB_URL} className="institutional-link text-sm font-semibold text-white">
        Current repository
      </a>
    </InstitutionalFrame>
  );
}

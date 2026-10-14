import type { Metadata } from "next";
import { InfoCard, InstitutionalFrame, SectionTitle } from "@/components/institutional/institutional-ui";

export const metadata: Metadata = {
  title: "Solutions · ValueCurator",
  description: "Potential uses of ValueCurator for tokenized assets, with the maturity of each offer.",
};

export default function SolutionsPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Solutions"
        title="Intelligence for tokenized markets."
        body="Sectors name the audience. Offerings name what could be delivered. None of them publishes a price."
      />
      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-institutional-cyan">Sectors</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Tokenized asset platforms" maturity="development" body="A platform can use the authorization demonstration as a pattern. Coverage of many assets is still being built." />
          <InfoCard title="Web3 financial infrastructure" maturity="implemented" body="The Devnet program and the public gate show how a proposal stops when evidence leaves the mandate." />
          <InfoCard title="Fintech integrations" maturity="planned" body="An interface for outside financial systems is a future offer." />
          <InfoCard title="Financial data services" maturity="planned" body="Pyth and Jupiter are read in the demonstration. A data service for clients is not a product yet." />
          <InfoCard title="Institutional financial applications" maturity="planned" body="Applications for institutions remain a direction. This site does not claim regulatory authorization." />
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-institutional-cyan">Offerings</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard title="Asset Intelligence API" maturity="planned" body="A product API for asset analysis is not in the repository." />
          <InfoCard title="Verifiable authorization infrastructure" maturity="implemented" body="The current offer is the mandate, the gate and the Devnet owner controls." />
          <InfoCard title="RWA integration services" maturity="development" body="The demonstration covers one documented asset and one Devnet mint. Integration for more tokenized assets is the current direction." />
          <InfoCard title="Quantitative research services" maturity="development" body="The discovery interview and the research direction exist. A client research service is not a launched product." />
        </div>
      </section>
    </InstitutionalFrame>
  );
}

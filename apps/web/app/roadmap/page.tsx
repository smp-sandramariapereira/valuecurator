import type { Metadata } from "next";
import { InfoCard, InstitutionalFrame, SectionTitle } from "@/components/institutional/institutional-ui";

export const metadata: Metadata = {
  title: "Roadmap · ValueCurator",
  description: "What ValueCurator has implemented, what is in development, and what is planned.",
};

export default function RoadmapPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Roadmap"
        title="Building the next layer of financial infrastructure."
        body="These groups are not dates and not a promise of delivery."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard
          title="Implemented"
          maturity="implemented"
          body="Devnet program, owner and operator separation, reference-price check, owner recovery, Pyth and Jupiter reads, approval-only AAPLx demonstration, discovery interviews, and the illustrative Devnet subscription."
        />
        <InfoCard
          title="In development"
          maturity="development"
          body="Extending the demonstration beyond one tokenized asset, and deepening the research path from interviews toward quantitative support."
        />
        <InfoCard
          title="Planned"
          maturity="planned"
          body="Asset intelligence as a product API, enterprise integrations, and a broader institutional offer. No price and no launch date are attached."
        />
      </div>
    </InstitutionalFrame>
  );
}

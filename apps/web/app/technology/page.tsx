import type { Metadata } from "next";
import { InfoCard, InstitutionalFrame, SectionTitle } from "@/components/institutional/institutional-ui";

export const metadata: Metadata = {
  title: "Technology · ValueCurator",
  description: "KAIROS Engine, the Discovery API, market evidence and the Devnet authorization program.",
};

export default function TechnologyPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Technology"
        title="From data to verifiable decisions."
        body="The notes below match the repository. A component that is still a direction is labeled that way."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          title="KAIROS Engine"
          maturity="implemented"
          body="Solana program for the node, the owner and operator keys, the reference price check, the yield split and owner recovery. It is deployed on Devnet for the demonstration."
        />
        <InfoCard
          title="Discovery API"
          maturity="implemented"
          body="Research sessions: a challenge, a wallet signature on a message, and stored interview answers. It does not move tokens."
        />
        <InfoCard
          title="Shared contracts"
          maturity="implemented"
          body="The discovery-contracts package defines the messages shared by the interview service and the web application."
        />
        <InfoCard
          title="AI research"
          maturity="development"
          body="The interview collects research evidence. A model that analyzes assets and authorizes orders is a research direction, not a running agent on this site."
        />
        <InfoCard
          title="Market evidence"
          maturity="implemented"
          body="The gate reads a Pyth price and a Jupiter quote for the AAPLx demonstration. That path does not submit a mainnet purchase. The on-chain price check reads the reference the owner posted."
        />
        <InfoCard
          title="Solana programs"
          maturity="implemented"
          body="The demonstration program is written with Anchor and runs on Devnet. The owner key and the operator key stay separate. Token-2022 holds the demonstration mint. This website does not upgrade the program."
        />
        <InfoCard
          title="Security controls"
          maturity="implemented"
          body="The owner key and the operator key are separate. A key that is not registered is rejected. The owner can recover the vault. This repository does not contain an independent security audit."
        />
      </div>
    </InstitutionalFrame>
  );
}

import type { Metadata } from "next";
import { InstitutionalFrame, SectionTitle, StatusLabel } from "@/components/institutional/institutional-ui";
import { CONTACT_EMAIL } from "@/lib/institutional";

export const metadata: Metadata = {
  title: "Partners · ValueCurator",
  description: "Collaboration interests for the Solana ecosystem, research partners and companies building tokenized assets.",
};

export default function PartnersPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Partnerships"
        title="Let’s build the future of finance."
        body="We collaborate with developers, researchers, financial technology companies and blockchain ecosystem partners to advance intelligent financial infrastructure."
      />
      <article className="institutional-panel max-w-3xl space-y-4 rounded-2xl border p-6">
        <StatusLabel maturity="planned" />
        <p className="text-sm leading-6 text-stocklana-muted">
          ValueCurator is expanding its participation in the Solana ecosystem and welcomes collaboration with Superteam Brasil, technology partners, research institutions and companies building tokenized financial infrastructure.
        </p>
        <p className="text-sm leading-6 text-stocklana-muted">
          This is an invitation. It is not an official partnership, and this page does not display partner logos.
        </p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="institutional-link inline-flex h-11 items-center rounded-xl bg-institutional-emerald px-5 text-sm font-semibold text-institutional-ink">
          Contact Our Team
        </a>
      </article>
    </InstitutionalFrame>
  );
}

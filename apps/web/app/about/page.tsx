import type { Metadata } from "next";
import { AboutIndex } from "@/components/institutional/about-index";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/institutional";

export const metadata: Metadata = {
  title: "About · ValueCurator",
  description: "Information about ValueCurator. The working application is the home page.",
  alternates: { canonical: `${SITE_URL}/about` },
};

export default function AboutPage() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ValueCurator",
    url: SITE_URL,
    description: "Research-driven financial infrastructure for tokenized assets on Solana.",
    email: CONTACT_EMAIL,
    sameAs: ["https://github.com/smp-sandramariapereira/valuecurator"],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <AboutIndex />
    </>
  );
}

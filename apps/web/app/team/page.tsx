import type { Metadata } from "next";
import { InstitutionalFrame, SectionTitle } from "@/components/institutional/institutional-ui";
import { TEAM } from "@/lib/institutional";

export const metadata: Metadata = {
  title: "Team · ValueCurator",
  description: "The founders building ValueCurator.",
};

export default function TeamPage() {
  return (
    <InstitutionalFrame>
      <SectionTitle
        eyebrow="Team"
        title="Founded on science. Engineered for real-world impact."
        body="The combined work covers artificial intelligence, computer engineering, bioinformatics and scientific research."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {TEAM.map((person) => (
          <article key={person.name} className="institutional-panel rounded-2xl border p-5">
            <p className="font-mono text-3xl text-institutional-emerald" aria-hidden="true">{person.name.slice(0, 1)}</p>
            <h2 className="mt-4 text-xl font-semibold text-white">{person.name}</h2>
            <p className="text-sm text-institutional-cyan">{person.role}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-stocklana-muted">{person.focus}</p>
            <p className="mt-4 text-sm leading-6 text-stocklana-muted">{person.bio}</p>
          </article>
        ))}
      </div>
    </InstitutionalFrame>
  );
}

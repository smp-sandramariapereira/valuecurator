export const SITE_URL = "https://www.valuecurator.xyz";
export const GITHUB_URL = "https://github.com/smp-sandramariapereira/valuecurator";
export const KAIROS_HISTORY_URL = "https://github.com/smp-sandramariapereira/KAIROS-Engine";
export const CONTACT_EMAIL = "webmaster@valuecurator.xyz";

export const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/technology", label: "Technology" },
  { href: "/solutions", label: "Solutions" },
  { href: "/journey", label: "Journey" },
  { href: "/team", label: "Team" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/partners", label: "Partners" },
] as const;

export type Maturity = "implemented" | "development" | "planned";

export const MATURITY_LABEL: Record<Maturity, string> = {
  implemented: "Implemented",
  development: "In development",
  planned: "Planned",
};

export const TEAM = [
  {
    name: "Sandra",
    role: "Co-Founder",
    focus: "Artificial intelligence",
    bio: "Bachelor's degree in Information Science. Master's degree in Informatics. PhD candidate in Informatics, focused on artificial intelligence.",
  },
  {
    name: "João",
    role: "Co-Founder",
    focus: "Computer engineering and bioinformatics",
    bio: "Computer engineer. PhD candidate in Neuroscience, with a focus on bioinformatics.",
  },
  {
    name: "A.",
    role: "Associate — Software Development",
    focus: "Software development",
    bio: "Computer science undergraduate. She previously pursued undergraduate studies in data science and artificial intelligence. Those studies were discontinued.",
  },
  {
    name: "H.",
    role: "Associate — Mathematics",
    focus: "Mathematics",
    bio: "Bachelor's degree in Mathematics.",
  },
] as const;

export const FLOW = [
  "Asset data",
  "Market evidence",
  "Analysis and policy evaluation",
  "Risk controls",
  "Authorization decision",
  "Auditable result",
] as const;

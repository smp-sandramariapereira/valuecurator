import Link from "next/link";
import { Home } from "lucide-react";

export function HomeButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-stocklana-border bg-stocklana-card/80 px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white transition hover:border-stocklana-accent/50"
    >
      <Home className="h-4 w-4" aria-hidden="true" />
      Home
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";

export function HomeButton() {
  return (
    <Link
      href="/"
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-stocklana-border bg-stocklana-card/80 px-3 font-mono text-xs font-semibold uppercase tracking-wider text-white transition hover:border-stocklana-accent/50"
    >
      <Image src="/valuecurator-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
      Home
    </Link>
  );
}

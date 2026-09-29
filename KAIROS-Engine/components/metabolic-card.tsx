import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type MetabolicCardTone = "accent" | "purple" | "blue";

const toneClass: Record<MetabolicCardTone, string> = {
  accent: "text-stocklana-accent",
  purple: "text-stocklana-purple",
  blue: "text-blue-300",
};

export function MetabolicCard({
  label,
  value,
  hint,
  tone = "accent",
  live = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: MetabolicCardTone;
  live?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <CardDescription className="uppercase tracking-[0.18em] text-stocklana-muted">
          {label}
        </CardDescription>
        {live ? (
          <Badge className="border-stocklana-accent/40 text-stocklana-accent">
            <span className="live-dot mr-1.5" />
            Live
          </Badge>
        ) : (
          <Badge>Devnet</Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className={cn("truncate font-mono text-2xl tabular-nums sm:text-3xl", toneClass[tone])}>
          {value}
        </p>
        <p className="mt-3 truncate font-mono text-[11px] text-stocklana-muted">{hint}</p>
      </CardContent>
    </Card>
  );
}

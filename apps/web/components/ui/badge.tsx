import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-stocklana-border bg-stocklana-bg/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-stocklana-muted backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

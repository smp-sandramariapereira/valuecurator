import Link from "next/link";
import { breadcrumbsFor } from "@/lib/product-navigation";

export function NavigationBreadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbsFor(pathname);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Trilha" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-stocklana-muted">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="text-white">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stocklana-accent/70">{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

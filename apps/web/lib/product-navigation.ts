export type ProductIcon = "home" | "portfolio" | "assets" | "research" | "proofgate" | "activity";

export type ProductNavItem = {
  id: string;
  label: string;
  href: string;
  description: string;
};

export type ProductNavGroup = {
  id: string;
  label: string;
  icon: ProductIcon;
  items: readonly ProductNavItem[];
};

export const PRODUCT_PREFIXES = ["/app", "/assets", "/lab", "/portfolio", "/research", "/proofgate", "/activity"] as const;

export const PRODUCT_NAVIGATION: readonly ProductNavGroup[] = [
  {
    id: "home",
    label: "Início",
    icon: "home",
    items: [{ id: "overview", label: "Visão geral", href: "/app", description: "Dashboard existente" }],
  },
  {
    id: "portfolio",
    label: "Portfólio",
    icon: "portfolio",
    items: [
      { id: "portfolio-view", label: "Visão do Portfólio", href: "/portfolio", description: "Composição planejada e estados vazios" },
      { id: "portfolio-build", label: "Construir Portfólio", href: "/portfolio/build", description: "Rascunho experimental local" },
      { id: "portfolio-rebalance", label: "Ajustar Portfólio", href: "/portfolio/rebalance", description: "Simulador de composição" },
      { id: "portfolio-mandates", label: "Meus Mandatos", href: "/portfolio/mandates", description: "Acesso ao laboratório existente" },
    ],
  },
  {
    id: "assets",
    label: "Ativos",
    icon: "assets",
    items: [
      { id: "assets-explore", label: "Explorar Ativos", href: "/assets", description: "Catálogo de pesquisa existente" },
      { id: "assets-verify", label: "Verificação de Ativos", href: "/assets/verify", description: "Três verificações independentes" },
      { id: "assets-compare", label: "Comparar Ativos", href: "/assets/compare", description: "Somente campos disponíveis" },
      { id: "assets-watchlist", label: "Lista de Observação", href: "/assets/watchlist", description: "Lista local experimental" },
    ],
  },
  {
    id: "research",
    label: "Inteligência",
    icon: "research",
    items: [
      { id: "research-home", label: "Central de Análises", href: "/research", description: "Acesso às análises existentes" },
      { id: "research-evidence", label: "Evidências de Mercado", href: "/research/evidence", description: "Sem consulta automática de preço" },
      { id: "research-lab", label: "Research Lab", href: "/interview", description: "Entrevista de descoberta existente" },
      { id: "research-scenarios", label: "Cenários", href: "/research/scenarios", description: "Demonstrações já existentes no dashboard" },
    ],
  },
  {
    id: "proofgate",
    label: "ProofGate",
    icon: "proofgate",
    items: [
      { id: "proofgate-home", label: "Central de Propostas", href: "/proofgate", description: "Sem propostas fabricadas" },
      { id: "proofgate-policies", label: "Políticas e Limites", href: "/proofgate/policies", description: "Acesso às telas que já aplicam política" },
      { id: "proofgate-authorizations", label: "Autorizações", href: "/proofgate/authorizations", description: "Autorização não é execução" },
      { id: "proofgate-lab", label: "Laboratório", href: "/lab", description: "Settlement Lab existente" },
    ],
  },
  {
    id: "activity",
    label: "Atividade",
    icon: "activity",
    items: [
      { id: "activity-home", label: "Visão Geral", href: "/activity", description: "Histórico somente quando persistido" },
      { id: "activity-proposals", label: "Propostas", href: "/activity/proposals", description: "Nenhum registro inventado" },
      { id: "activity-operations", label: "Operações", href: "/activity/operations", description: "Nenhuma operação inventada" },
      { id: "activity-receipts", label: "Recibos", href: "/activity/receipts", description: "Recibos continuam no laboratório" },
    ],
  },
];

export const ACCOUNT_LINKS = [
  { href: "/about", label: "Sobre" },
  { href: "/subscribe", label: "Assinatura" },
] as const;

export function isProductPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PRODUCT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const EXACT_HREFS = new Set(["/app", "/lab", "/interview", "/assets"]);

export function navigationMatches(href: string, pathname: string): boolean {
  if (EXACT_HREFS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavigationItem(pathname: string): ProductNavItem | null {
  const items = PRODUCT_NAVIGATION.flatMap((group) => group.items);
  if (pathname === "/") return items.find((item) => item.id === "overview") ?? null;
  const matched = items.filter((item) => navigationMatches(item.href, pathname));
  if (matched.length === 0 && pathname.startsWith("/assets/")) {
    return items.find((item) => item.id === "assets-verify") ?? null;
  }
  return matched.sort((left, right) => right.href.length - left.href.length)[0] ?? null;
}

export function breadcrumbsFor(pathname: string): readonly { label: string; href: string }[] {
  const item = activeNavigationItem(pathname);
  if (!item) return [];
  const group = PRODUCT_NAVIGATION.find((candidate) => candidate.items.some((entry) => entry.id === item.id));
  if (!group) return [{ label: item.label, href: item.href }];
  if (group.items.length === 1) return [{ label: group.label, href: item.href }];
  return [
    { label: group.label, href: group.items[0].href },
    { label: item.label, href: item.href },
  ];
}

export function groupIsActive(group: ProductNavGroup, pathname: string): boolean {
  return group.items.some((item) => item.id === activeNavigationItem(pathname)?.id);
}

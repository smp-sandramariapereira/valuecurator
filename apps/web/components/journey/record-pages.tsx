import Link from "next/link";
import { JourneyNotice, JourneyScreen } from "@/components/journey/journey-screen";

export function ResearchHome() {
  return (
    <JourneyScreen kicker="Inteligência" title="Central de Análises" lede="Esta central aponta para as análises que já existem. Uma saída de pesquisa não é autorização financeira.">
      <JourneyNotice>Nenhuma avaliação nova é gerada nesta página.</JourneyNotice>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-stocklana-accent underline" href="/research/evidence">Evidências de mercado</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/interview">Research Lab</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/research/scenarios">Cenários de demonstração</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/app">Dashboard, onde a evidência já pode ser consultada</Link></li>
      </ul>
    </JourneyScreen>
  );
}

export function ResearchEvidence() {
  return (
    <JourneyScreen kicker="Evidência" title="Evidências de Mercado" lede="Abrir esta página não consulta um provedor de preços.">
      <JourneyNotice>Fonte não consultada nesta sessão. A leitura ao vivo continua no dashboard e só ocorre quando alguém pede a atualização.</JourneyNotice>
      <p className="text-sm text-stocklana-muted">Proveniência, horário e resultado aparecem no cartão de evidência de /app depois de uma consulta explícita. Um cenário simulado permanece identificado como simulação.</p>
      <Link className="text-sm text-stocklana-accent underline" href="/app">Ir para o dashboard</Link>
    </JourneyScreen>
  );
}

export function ResearchScenarios() {
  return (
    <JourneyScreen kicker="Demonstração" title="Cenários" lede="SAFE, STALE e DIVERGENCE já existem no dashboard como simulações. Esta página não cria uma quarta simulação.">
      <JourneyNotice>Os números de um cenário simulado não são um preço ao vivo.</JourneyNotice>
      <p className="text-sm text-stocklana-muted">Use os botões de cenário já presentes em /app. Eles não enviam transação.</p>
      <Link className="text-sm text-stocklana-accent underline" href="/app">Abrir os cenários existentes</Link>
    </JourneyScreen>
  );
}

export function ProofGateHome() {
  return (
    <JourneyScreen kicker="Propostas" title="Central de Propostas" lede="Não há um arquivo persistido de propostas fora das telas que já as calculam.">
      <JourneyNotice>Nenhuma proposta foi fabricada para preencher esta lista.</JourneyNotice>
      <p className="text-sm text-stocklana-muted">Os rótulos DRAFT, PENDING_REVIEW, BLOCKED, AUTHORIZED, EXPIRED e REVOKED descrevem a apresentação. Eles não criam uma máquina de estados nova. REVIEWABLE não significa AUTHORIZED.</p>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-stocklana-accent underline" href="/app?view=gate">Avaliação já existente no dashboard</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/lab">Laboratório, onde a carteira pode pedir uma decisão</Link></li>
      </ul>
    </JourneyScreen>
  );
}

export function ProofGatePolicies() {
  return (
    <JourneyScreen kicker="Política" title="Políticas e Limites" lede="Os limites continuam nas telas e nos serviços que já os aplicam. Esta página não edita uma política.">
      <p className="text-sm text-stocklana-muted">O dashboard guarda a validação do mandato visual. O laboratório aplica o teto do runtime local. Nenhum limite novo foi criado aqui.</p>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-stocklana-accent underline" href="/app?view=mandate">Mandato visual existente</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/lab">Limites do laboratório</Link></li>
      </ul>
    </JourneyScreen>
  );
}

export function ProofGateAuthorizations() {
  return (
    <JourneyScreen kicker="Autorização" title="Autorizações" lede="Uma autorização assinada ainda precisa da assinatura do proprietário e da confirmação da rede. Ela não é, por si, uma execução.">
      <JourneyNotice>Não há autorizações persistidas nesta página.</JourneyNotice>
      <p className="text-sm text-stocklana-muted">Os rótulos de execução AWAITING_OWNER_SIGNATURE, SUBMITTED, CONFIRMED, EXECUTED e FAILED só serão usados quando uma fonte existente informar esse estado. O laboratório continua sendo o lugar da assinatura.</p>
      <Link className="text-sm text-stocklana-accent underline" href="/lab">Abrir o laboratório</Link>
    </JourneyScreen>
  );
}

export function ActivityHome() {
  return (
    <JourneyScreen kicker="Auditoria" title="Atividade" lede="Sem histórico persistido, a lista fica vazia. Uma autorização não é tratada como execução.">
      <JourneyNotice>Nenhum histórico foi inventado.</JourneyNotice>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-stocklana-accent underline" href="/activity/proposals">Propostas</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/activity/operations">Operações</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/activity/receipts">Recibos</Link></li>
        <li><Link className="text-stocklana-accent underline" href="/app?view=audit">Auditoria já existente no dashboard</Link></li>
      </ul>
    </JourneyScreen>
  );
}

export function ActivityEmpty({ title, body, href, hrefLabel }: { title: string; body: string; href: string; hrefLabel: string }) {
  return (
    <JourneyScreen kicker="Sem registros persistidos" title={title} lede={body}>
      <JourneyNotice>Nenhum registro foi fabricado.</JourneyNotice>
      <Link className="text-sm text-stocklana-accent underline" href={href}>{hrefLabel}</Link>
    </JourneyScreen>
  );
}

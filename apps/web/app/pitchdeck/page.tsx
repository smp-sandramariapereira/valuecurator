import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { InstitutionalFrame } from "@/components/institutional/institutional-ui";
import { AskFigure, CyberneticLoop, MarketFigure, ModelFigure, ParadigmDiagram, PipelineDiagram, PositionMatrix, ProofTerminal, ResearchFigure, RoadmapBoard, TriadFigure } from "@/components/pitch/pitch-figures";
import { CONTACT_EMAIL, GITHUB_URL, SITE_URL } from "@/lib/institutional";
import { DEFAULT_PROGRAM_ID } from "@/lib/kairos";

export const metadata: Metadata = {
  title: "Pitch · ValueCurator",
  description: "Autorização com evidência para quem já tem o capital. A IA aconselha. O dono governa. Feito para o ICM Lab Solana.",
  alternates: { canonical: `${SITE_URL}/pitchdeck` },
};

const ICM_LAB = "https://www.darwinstartups.com/icmlab";
const PROGRAM_SHORT = `${DEFAULT_PROGRAM_ID.slice(0, 6)}…${DEFAULT_PROGRAM_ID.slice(-4)}`;
const EXPLORER = `https://explorer.solana.com/address/${DEFAULT_PROGRAM_ID}?cluster=devnet`;

const SECTIONS = [
  { href: "#tese", label: "Tese" },
  { href: "#problema", label: "Problema" },
  { href: "#governanca", label: "Governança" },
  { href: "#produto", label: "Produto" },
  { href: "#arquitetura", label: "Arquitetura" },
  { href: "#mercado", label: "Mercado" },
  { href: "#pesquisa", label: "Pesquisa" },
  { href: "#modelo", label: "Modelo" },
  { href: "#provas", label: "Provas" },
  { href: "#concorrencia", label: "Concorrência" },
  { href: "#roteiro", label: "Roteiro" },
  { href: "#equipe", label: "Equipe" },
] as const;

export default function PitchDeckPage() {
  return (
    <InstitutionalFrame>
      <div lang="pt" className="space-y-8">
        <header className="space-y-8 pb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-institutional-cyan">
            <a href={ICM_LAB} className="institutional-link hover:text-white">ICM Lab Solana · Darwin Startups</a>
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">
            O dono escreve o mandato. O agente propõe. A Solana decide.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-stocklana-muted">
            ValueCurator é a infraestrutura de autorização para quem já tem o capital. A inteligência aconselha. A evidência prova. A política autoriza. A chave fica com o dono.
          </p>
          <p className="text-sm text-stocklana-muted">Sandra Pereira e João Nitzsche</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Programa" value="Devnet" detail={PROGRAM_SHORT} href={EXPLORER} />
            <Stat label="Evidência" value="Mainnet, só leitura" detail="Pyth · feed 922" href="https://www.pyth.network/price-feeds" />
            <Stat label="Cofre" value="PDA do dono" detail="Uma carteira, um nó" />
            <Stat label="Aplicação" value="valuecurator.xyz" detail="Portão de aprovação" href={SITE_URL} />
          </div>
          <nav aria-label="Seções do pitch" className="flex flex-wrap gap-2">
            {SECTIONS.map((section, index) => (
              <a key={section.href} href={section.href} className="institutional-link rounded-lg border border-white/10 px-3 py-2 text-sm text-stocklana-muted hover:text-white">
                <span className="font-mono text-[10px] text-institutional-cyan">{String(index + 1).padStart(2, "0")}</span> {section.label}
              </a>
            ))}
          </nav>
        </header>

        <Band index={0} id="tese" eyebrow="Tese" title="Gestão do ativo que o dono já tem" body="O ICM Lab procura gestão de ativos. O ValueCurator fala com essa tese a partir do cofre: o dono já detém o capital, e o produto decide se uma proposta pode mexer nele. Emissão de ação da bolsa brasileira e protocolo de consórcio ficam fora deste sistema.">
          <ol className="space-y-3">
            {[
              "A IA aconselha. Ela não tem chave.",
              "A evidência prova. Pyth e Jupiter entram como leitura.",
              "A política autoriza. Idade, confiança, desvio e impacto precisam caber no mandato.",
              "O dono governa. Ele escreve o limite, troca o operador e retira em emergência.",
            ].map((line, index) => (
              <li key={line} className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#0C1624]">
                <span className="w-1.5 shrink-0 bg-[#3DDC97]" />
                <span className="px-4 py-3 text-base leading-7 text-white"><span className="font-mono text-xs text-[#3DDC97]">0{index + 1} </span>{line}</span>
              </li>
            ))}
          </ol>
        </Band>

        <Band index={1} id="problema" eyebrow="Problema" title="Uma chave na mão do modelo" body="Um modelo muda de resposta. Uma assinatura na Solana permanece. O risco do agente autônomo é esse encontro.">
          <ParadigmDiagram />
        </Band>

        <Band index={2} id="governanca" eyebrow="Governança" title="Autonomia do agente, soberania do dono" body="O agente procura dentro do texto que o dono gravou. A liberdade de propor acaba onde o mandato acaba.">
          <CyberneticLoop />
        </Band>

        <Band index={3} id="produto" eyebrow="Produto" title="Seis travas antes de qualquer movimento" body="O rascunho do mandato abre com estes números. O dono pode apertá-los. O programa da Devnet guarda o preço de referência que ele mesmo publicou.">
          <TriadFigure />
        </Band>

        <Band index={4} id="arquitetura" eyebrow="Arquitetura" title="Duas redes, um portão" body="A leitura de AAPLx vive na mainnet. O cofre de demonstração vive na Devnet. Uma transação não atravessa os dois clusters.">
          <PipelineDiagram />
        </Band>

        <Band index={5} id="mercado" eyebrow="Mercado" title="Quem paga é o dono do nó" body="O primeiro cliente é um dono, uma carteira, um ativo. Ele já tem o capital e paga pelo portão. Clubes, agentes e tesourarias entram depois, cada um com a própria carteira.">
          <MarketFigure />
        </Band>

        <Band index={6} id="pesquisa" eyebrow="Pesquisa" title="A evidência entra. A assinatura fica." body="O motor de cálculo recebe um preço. Ele devolve idade, confiança e desvio. Essa conta não é uma assinatura, e a direção de pesquisa não substitui o portão que a demonstração já executa.">
          <ResearchFigure />
        </Band>

        <Band index={7} id="modelo" eyebrow="Modelo" title="O nó se paga. O ativo não se vende aqui." body="A tela de assinatura mostra 1 USDC por mês, na Devnet, para a carteira de recebimento do produto. O valor é ilustração. Ele não compra AAPLx e não entra no programa.">
          <ModelFigure />
        </Band>

        <Band index={8} id="provas" eyebrow="Provas" title="O que um avaliador abre" body="Três objetos. O programa na Devnet. A leitura de AAPLx na mainnet. O recibo que aprova ou bloqueia sem enviar a compra.">
          <ProofTerminal />
        </Band>

        <Band index={9} id="concorrencia" eyebrow="Concorrência" title="Entre o bot e o multisig" body="O bot é rápido e carrega a chave. O multisig é lento e espera pessoas. O fundo tradicional esconde a regra. O ValueCurator publica a regra e recusa sozinho quando a evidência sai dela.">
          <PositionMatrix />
        </Band>

        <Band index={10} id="roteiro" eyebrow="Roteiro" title="A próxima prova é uma recusa com capital real" body="O programa já está na Devnet. A mainnet já é leitura. O passo que falta é um dono, com o ativo dele, vendo o portão recusar uma compra. Mainnet como destino de implantação continua fora do que este repositório autoriza.">
          <RoadmapBoard />
        </Band>

        <Band index={11} id="equipe" eyebrow="Equipe" title="Duas formações, um portão" body="Sandra Pereira e João Nitzsche. A formação publicada é ciência da informação, informática e inteligência artificial; engenharia de computação e bioinformática. O ICM Lab valoriza quem já operou Pix, SPB e câmbio. Essa prática não está na formação publicada. O pedido ao laboratório é mentoria dessa operação e uma prova de conceito.">
          <div className="space-y-3">
            <article className="institutional-panel rounded-2xl border p-5">
              <h3 className="text-2xl font-semibold text-white">Sandra Pereira</h3>
              <p className="mt-1 text-base text-institutional-cyan">Cofundadora</p>
              <p className="mt-3 text-sm leading-6 text-stocklana-muted">Bacharelado em Ciência da Informação. Mestrado em Informática. Doutorado em Informática, com foco em inteligência artificial.</p>
            </article>
            <article className="institutional-panel rounded-2xl border p-5">
              <h3 className="text-2xl font-semibold text-white">João Nitzsche</h3>
              <p className="mt-1 text-base text-institutional-cyan">Cofundador</p>
              <p className="mt-3 text-sm leading-6 text-stocklana-muted">Engenharia de computação. Doutorado em Neurociência, com foco em bioinformática.</p>
            </article>
            <AskFigure />
            <article className="institutional-panel space-y-4 rounded-2xl border p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-institutional-emerald">ICM Lab</p>
              <p className="text-base leading-7 text-white">
                As inscrições publicadas foram de 14 de setembro a 11 de outubro de 2026. O programa seleciona até 10 startups para aceleração, com mentoria, plano Darwin Way e prova de conceito com cliente corporativo.
              </p>
              <div className="flex flex-wrap gap-3">
                <a href={ICM_LAB} className="inline-flex h-11 items-center rounded-xl bg-institutional-emerald px-5 text-sm font-semibold text-institutional-ink">Página do ICM Lab</a>
                <a href={SITE_URL} className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white">Aplicação ao vivo</a>
                <a href={GITHUB_URL} className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white">GitHub</a>
                <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white">{CONTACT_EMAIL}</a>
                <Link href="/?view=gate" className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white">Abrir o portão</Link>
              </div>
            </article>
          </div>
        </Band>
      </div>
    </InstitutionalFrame>
  );
}

function Band({
  index,
  id,
  eyebrow,
  title,
  body,
  children,
}: {
  index: number;
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  const flip = index % 2 === 1;
  return (
    <section id={id} className={`scroll-mt-24 rounded-3xl border p-6 sm:p-8 ${flip ? "bg-white/[0.04]" : "bg-transparent"}`}>
      <div className="grid items-start gap-8 md:grid-cols-2">
        <div className={`max-w-xl space-y-4 ${flip ? "md:order-2" : ""}`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-institutional-cyan">
            {String(index + 1).padStart(2, "0")} · {eyebrow}
          </p>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{title}</h2>
          <p className="text-base leading-7 text-stocklana-muted">{body}</p>
        </div>
        <div className={flip ? "md:order-1" : ""}>{children}</div>
      </div>
    </section>
  );
}

function Stat({ label, value, detail, href }: { label: string; value: string; detail: string; href?: string }) {
  const content = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-institutional-cyan">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-stocklana-muted">{detail}</p>
    </>
  );
  if (!href) return <article className="institutional-panel rounded-2xl border p-4">{content}</article>;
  return (
    <a href={href} className="institutional-panel rounded-2xl border p-4 hover:border-institutional-cyan/50" target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
      {content}
    </a>
  );
}

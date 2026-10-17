import type { ReactNode } from "react";

const font = "ui-monospace, monospace";

function Frame({ children, label, tone = "cyan" }: { children: ReactNode; label: string; tone?: "cyan" | "red" | "green" }) {
  const border = tone === "red" ? "border-[#F07167]/50" : tone === "green" ? "border-[#3DDC97]/40" : "border-white/10";
  const ink = tone === "red" ? "text-[#F07167]" : tone === "green" ? "text-[#3DDC97]" : "text-institutional-cyan";
  return (
    <figure className={`rounded-2xl border ${border} bg-[#0C1624] p-3`}>
      <figcaption className={`mb-3 font-mono text-[10px] uppercase tracking-[0.16em] ${ink}`}>{label}</figcaption>
      {children}
    </figure>
  );
}

export function ParadigmDiagram() {
  return (
    <div className="space-y-3">
      <Frame label="Paradigma vulnerável" tone="red">
        <svg viewBox="0 0 520 92" className="h-auto w-full" role="img">
          <title>Agente probabilístico segura a chave e drena o cofre</title>
          <rect x="4" y="16" width="132" height="60" rx="8" fill="#2A1218" stroke="#F07167" />
          <text x="70" y="40" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Agente</text>
          <text x="70" y="56" textAnchor="middle" fill="#F07167" fontSize="9" fontFamily={font}>modelo neural</text>
          <path d="M140 46 H188" stroke="#F07167" strokeWidth="1.5" />
          <text x="164" y="38" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>segura</text>
          <rect x="192" y="16" width="132" height="60" rx="8" fill="#2A1218" stroke="#F07167" />
          <text x="258" y="40" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Chave privada</text>
          <text x="258" y="56" textAnchor="middle" fill="#F07167" fontSize="9" fontFamily={font}>assina tudo</text>
          <path d="M328 46 H376" stroke="#F07167" strokeWidth="1.5" />
          <text x="352" y="38" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>quebra</text>
          <rect x="380" y="16" width="132" height="60" rx="8" fill="#2A1218" stroke="#F07167" />
          <text x="446" y="40" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Cofre drenado</text>
          <text x="446" y="56" textAnchor="middle" fill="#F07167" fontSize="9" fontFamily={font}>perda irreversível</text>
        </svg>
      </Frame>
      <Frame label="Paradigma neurossimbólico" tone="green">
        <svg viewBox="0 0 520 210" className="h-auto w-full" role="img">
          <title>O portão separa o agente da chave. Sim gera recibo. Não trava.</title>
          <rect x="8" y="18" width="128" height="48" rx="8" fill="#10261C" stroke="#3DDC97" />
          <text x="72" y="38" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Agente</text>
          <text x="72" y="52" textAnchor="middle" fill="#3DDC97" fontSize="9" fontFamily={font}>núcleo Kairos</text>
          <rect x="8" y="84" width="128" height="48" rx="8" fill="#102033" stroke="#7DA2F8" />
          <text x="72" y="104" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Pyth 922</text>
          <text x="72" y="118" textAnchor="middle" fill="#7DA2F8" fontSize="9" fontFamily={font}>leitura mainnet</text>
          <path d="M136 42 C 160 42, 168 62, 188 70" fill="none" stroke="#3DDC97" strokeWidth="1.5" />
          <path d="M136 108 C 160 108, 168 90, 188 82" fill="none" stroke="#7DA2F8" strokeWidth="1.5" />
          <rect x="188" y="48" width="118" height="56" rx="8" fill="#10261C" stroke="#3DDC97" />
          <text x="247" y="70" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Portão</text>
          <text x="247" y="86" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>idade ∧ desvio</text>
          <path d="M306 76 H338" stroke="#E0B96A" strokeWidth="1.5" />
          <polygon points="368,76 392,52 416,76 392,100" fill="#1A2433" stroke="#E0B96A" />
          <text x="392" y="80" textAnchor="middle" fill="#E0B96A" fontSize="8" fontFamily={font}>passa?</text>
          <path d="M416 64 H430" stroke="#3DDC97" strokeWidth="1.5" />
          <text x="422" y="56" fill="#3DDC97" fontSize="8" fontFamily={font}>sim</text>
          <rect x="430" y="18" width="82" height="44" rx="8" fill="#10261C" stroke="#3DDC97" />
          <text x="471" y="36" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>Recibo</text>
          <text x="471" y="50" textAnchor="middle" fill="#3DDC97" fontSize="8" fontFamily={font}>Ed25519</text>
          <path d="M471 62 V118" stroke="#3DDC97" strokeWidth="1.5" />
          <rect x="420" y="118" width="92" height="48" rx="8" fill="#10261C" stroke="#3DDC97" />
          <text x="466" y="138" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>PDA</text>
          <text x="466" y="152" textAnchor="middle" fill="#3DDC97" fontSize="8" fontFamily={font}>metabolize_yield</text>
          <path d="M392 100 V128" stroke="#F07167" strokeWidth="1.5" />
          <text x="398" y="116" fill="#F07167" fontSize="8" fontFamily={font}>não</text>
          <rect x="300" y="128" width="108" height="48" rx="8" fill="#2A1218" stroke="#F07167" />
          <text x="354" y="148" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>Falha fechada</text>
          <text x="354" y="162" textAnchor="middle" fill="#F07167" fontSize="8" fontFamily={font}>liquidez parada</text>
        </svg>
      </Frame>
    </div>
  );
}

export function CyberneticLoop() {
  const nodes = [
    ["Dono", "humano", "#E0B96A"],
    ["Mandato", "cofre PDA", "#7DA2F8"],
    ["Kairos", "agente", "#6BAED6"],
    ["Portão", "verificador", "#3DDC97"],
    ["Solana", "runtime", "#C4B5FD"],
  ] as const;
  return (
    <Frame label="Laço cibernético de segunda ordem" tone="cyan">
      <div className="grid grid-cols-5 gap-1">
        {nodes.map(([name, role, color]) => (
          <div key={name} className="rounded-lg border px-1 py-2 text-center" style={{ borderColor: color }}>
            <p className="font-mono text-[10px] text-white">{name}</p>
            <p className="font-mono text-[8px]" style={{ color }}>{role}</p>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 520 78" className="mt-1 h-auto w-full" aria-hidden="true">
        <path d="M52 18 H140" stroke="#E0B96A" strokeWidth="1.4" />
        <text x="96" y="14" textAnchor="middle" fill="#E0B96A" fontSize="8" fontFamily={font}>1. cura os limites</text>
        <path d="M250 36 H340" stroke="#7DA2F8" strokeWidth="1.4" />
        <text x="295" y="32" textAnchor="middle" fill="#7DA2F8" fontSize="8" fontFamily={font}>2. intenção</text>
        <path d="M360 18 H450" stroke="#3DDC97" strokeWidth="1.4" />
        <text x="405" y="14" textAnchor="middle" fill="#3DDC97" fontSize="8" fontFamily={font}>3. Pyth 922</text>
      </svg>
      <div className="mt-2 rounded-xl border border-dashed border-[#3DDC97]/60 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#3DDC97]">Invariantes satisfeitos</p>
        <p className="mt-2 font-mono text-[11px] leading-5 text-white">4. Recibo Ed25519 → 5. metabolize_yield → 6. rendimento no cofre, override com o dono</p>
      </div>
      <div className="mt-2 rounded-xl border border-dashed border-[#F07167]/70 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#F07167]">Invariante rompido</p>
        <p className="mt-2 font-mono text-[11px] leading-5 text-white">4. Trava fechada → 5. alerta: risco rejeitado</p>
      </div>
    </Frame>
  );
}

export function TriadFigure() {
  const layers = [
    ["01", "Camada neural", "aconselha", "Kairos e os oráculos", "#7DA2F8"],
    ["02", "Portão simbólico", "prova", "Seis invariantes", "#3DDC97"],
    ["03", "PDA na Solana", "governa", "Dono e operador separados", "#C4B5FD"],
  ] as const;
  const checks = [
    ["C1", "Ativo", "Mint no conjunto do dono. AAPLx na mainnet."],
    ["C2", "Volume", "100 USDC por ordem, 500 USDC no dia."],
    ["C3", "Idade", "30 segundos. Preço velho fecha."],
    ["C4", "Confiança", "100 bps. Intervalo largo fecha."],
    ["C5", "Desvio", "200 bps entre Jupiter e a referência."],
    ["C6", "Impacto", "100 bps de slippage na rota."],
  ] as const;
  return (
    <div className="space-y-3">
      {layers.map(([index, title, verb, detail, color]) => (
        <div key={index} className="flex overflow-hidden rounded-xl border border-white/10 bg-[#0C1624]">
          <div className="w-1.5 shrink-0" style={{ background: color }} />
          <div className="px-3 py-2">
            <p className="font-mono text-[10px]" style={{ color }}>{index} · {verb}</p>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-stocklana-muted">{detail}</p>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {checks.map(([id, title, body]) => (
          <div key={id} className="rounded-xl border border-white/10 bg-[#0C1624] p-3">
            <p className="font-mono text-[10px] text-institutional-cyan">{id}</p>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-5 text-stocklana-muted">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineDiagram() {
  return (
    <Frame label="Pipeline das duas redes" tone="cyan">
      <svg viewBox="0 0 520 300" className="h-auto w-full" role="img">
        <title>Mainnet lê. O núcleo confere. A Devnet custodia.</title>
        <rect x="8" y="8" width="504" height="78" rx="10" fill="none" stroke="#7DA2F8" />
        <text x="20" y="26" fill="#7DA2F8" fontSize="10" fontFamily={font}>MAINNET · SÓ LEITURA</text>
        <rect x="24" y="36" width="200" height="40" rx="6" fill="#102033" stroke="#7DA2F8" />
        <text x="124" y="54" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Pyth 922</text>
        <text x="124" y="68" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>preço e confiança</text>
        <rect x="292" y="36" width="200" height="40" rx="6" fill="#102033" stroke="#6BAED6" />
        <text x="392" y="54" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Jupiter v6</text>
        <text x="392" y="68" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>cotação executável</text>
        <path d="M124 76 V96" stroke="#7DA2F8" strokeWidth="1.4" />
        <path d="M392 76 V96" stroke="#6BAED6" strokeWidth="1.4" />
        <rect x="8" y="96" width="504" height="100" rx="10" fill="none" stroke="#E0B96A" />
        <text x="20" y="114" fill="#E0B96A" fontSize="10" fontFamily={font}>NÚCLEO · FORA DA CADEIA</text>
        <rect x="24" y="126" width="150" height="52" rx="6" fill="#1A2433" stroke="#E0B96A" />
        <text x="99" y="148" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>Verificador</text>
        <text x="99" y="164" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>invariantes</text>
        <path d="M178 152 H210" stroke="#E0B96A" strokeWidth="1.4" />
        <rect x="214" y="126" width="150" height="52" rx="6" fill="#1A2433" stroke="#E0B96A" />
        <text x="289" y="148" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>Mandato</text>
        <text x="289" y="164" textAnchor="middle" fill="#A8B3C2" fontSize="8" fontFamily={font}>do dono</text>
        <path d="M368 152 H400" stroke="#3DDC97" strokeWidth="1.4" />
        <rect x="404" y="126" width="92" height="52" rx="6" fill="#10261C" stroke="#3DDC97" />
        <text x="450" y="148" textAnchor="middle" fill="#F5F7FB" fontSize="10" fontFamily={font}>Recibo</text>
        <text x="450" y="164" textAnchor="middle" fill="#3DDC97" fontSize="8" fontFamily={font}>Ed25519</text>
        <path d="M260 196 V214" stroke="#3DDC97" strokeWidth="1.4" />
        <rect x="8" y="214" width="504" height="78" rx="10" fill="none" stroke="#3DDC97" />
        <text x="20" y="232" fill="#3DDC97" fontSize="10" fontFamily={font}>DEVNET · CUSTÓDIA</text>
        <rect x="24" y="242" width="220" height="40" rx="6" fill="#10261C" stroke="#3DDC97" />
        <text x="134" y="260" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Operador</text>
        <text x="134" y="274" textAnchor="middle" fill="#3DDC97" fontSize="8" fontFamily={font}>só metabolize_yield</text>
        <rect x="272" y="242" width="220" height="40" rx="6" fill="#2A1218" stroke="#F07167" />
        <text x="382" y="260" textAnchor="middle" fill="#F5F7FB" fontSize="11" fontFamily={font}>Dono</text>
        <text x="382" y="274" textAnchor="middle" fill="#F07167" fontSize="8" fontFamily={font}>emergency_withdraw</text>
      </svg>
    </Frame>
  );
}

export function MarketFigure() {
  const rows = [
    ["B2C", "Dono individual", "A chave não sai da carteira", "Pé-de-meia", "#7DA2F8"],
    ["B2B", "Clube ou family office", "O mandato é do responsável", "Gestão on-chain", "#3DDC97"],
    ["B2A", "Quem constrói o agente", "O agente propõe, o portão recusa", "Armadura", "#C4B5FD"],
    ["B2D", "Tesouraria", "Teto de gasto publicado", "Defesa do caixa", "#E0B96A"],
    ["B2B2C", "Fintech", "O portão entra atrás do app", "Marca branca", "#F0A0C0"],
  ] as const;
  return (
    <Frame label="Cinco verticais do material" tone="cyan">
      <div className="space-y-2">
        {rows.map(([id, who, pain, place, color]) => (
          <div key={id} className="flex overflow-hidden rounded-lg border border-white/10">
            <div className="w-1.5 shrink-0" style={{ background: color }} />
            <div className="grid flex-1 grid-cols-[3.2rem_1fr] gap-2 px-3 py-2">
              <p className="font-mono text-xs font-semibold" style={{ color }}>{id}</p>
              <div>
                <p className="text-sm text-white">{who}</p>
                <p className="text-xs text-stocklana-muted">{pain} · {place}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function ResearchFigure() {
  return (
    <Frame label="Duas leituras, uma conta" tone="cyan">
      <div className="space-y-2">
        <div className="rounded-xl border border-[#F07167]/40 bg-[#0C1624] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#F07167]">Análise que chega tarde</p>
          <p className="mt-1 text-sm text-stocklana-muted">Média móvel no gráfico. Balanço no trimestre.</p>
        </div>
        <div className="rounded-xl border border-[#7DA2F8]/50 bg-[#0C1624] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7DA2F8]">ValueCurator</p>
          <p className="mt-2 text-sm text-white">Jupiter · fluxo e profundidade da rota</p>
          <p className="text-sm text-white">Pyth · preço, confiança e instante</p>
          <p className="mt-2 font-mono text-xs text-[#E0B96A]">idade = agora − publicação</p>
          <p className="font-mono text-xs text-[#E0B96A]">confiança × 10000 / preço</p>
          <p className="font-mono text-xs text-[#E0B96A]">|cotação − referência| × 10000 / referência</p>
        </div>
      </div>
    </Frame>
  );
}

export function ModelFigure() {
  return (
    <Frame label="Dois motores" tone="green">
      <div className="space-y-2">
        <div className="rounded-xl border border-[#3DDC97]/40 p-3">
          <p className="font-mono text-[10px] text-[#3DDC97]">Motor 1 · nó</p>
          <p className="text-sm text-white">1 USDC / nó / mês na tela Devnet</p>
          <p className="text-xs text-stocklana-muted">Ilustração. Não compra o ativo.</p>
        </div>
        <div className="mx-auto h-4 w-px bg-[#3DDC97]/50" />
        <div className="rounded-xl border border-[#7DA2F8]/40 p-3">
          <p className="font-mono text-[10px] text-[#7DA2F8]">Motor 2 · cofre</p>
          <p className="text-sm text-white">metabolize_yield · 15% ao tesouro do dono</p>
          <p className="text-xs text-stocklana-muted">Parcela do nó, não a mensalidade.</p>
        </div>
        <div className="mx-auto h-4 w-px bg-[#E0B96A]/50" />
        <div className="rounded-xl border border-[#E0B96A]/50 p-3">
          <p className="font-mono text-[10px] text-[#E0B96A]">Tesouro do nó</p>
          <p className="text-sm text-white">O dono escolhe o destino na criação.</p>
        </div>
      </div>
    </Frame>
  );
}

export function ProofTerminal() {
  const lines = [
    ["PASS", "Preço velho", "o portão fecha"],
    ["PASS", "Desvio acima do mandato", "a cotação não passa"],
    ["PASS", "Recibo Ed25519", "compra não enviada"],
    ["PASS", "metabolize_yield", "15% ao tesouro do nó"],
    ["PASS", "emergency_withdraw", "operador de fora rejeitado"],
  ] as const;
  return (
    <Frame label="Provas que um avaliador abre" tone="green">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#070D16]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[#F07167]" />
          <span className="h-2 w-2 rounded-full bg-[#E0B96A]" />
          <span className="h-2 w-2 rounded-full bg-[#3DDC97]" />
          <span className="ml-2 font-mono text-[10px] text-stocklana-muted">portão · devnet + leitura mainnet</span>
        </div>
        <ul className="space-y-2 px-3 py-3 font-mono text-[11px] leading-5">
          {lines.map(([mark, name, detail]) => (
            <li key={name}>
              <span className="text-[#3DDC97]">[{mark}]</span> <span className="text-white">{name}</span>
              <span className="block text-stocklana-muted">└ {detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

export function PositionMatrix() {
  const dots = [
    { x: 78, y: 58, label: "Squads", fill: "#E0B96A" },
    { x: 250, y: 42, label: "ValueCurator", fill: "#3DDC97" },
    { x: 70, y: 168, label: "Fundos 2/20", fill: "#F07167" },
    { x: 230, y: 150, label: "Bots de modelo", fill: "#F07167" },
    { x: 268, y: 196, label: "Bots com chave", fill: "#F07167" },
  ];
  return (
    <Frame label="Matriz de posição" tone="cyan">
      <svg viewBox="0 0 320 240" className="h-auto w-full" role="img">
        <title>ValueCurator no quadrante de falha fechada e autonomia</title>
        <line x1="36" y1="120" x2="300" y2="120" stroke="#2B3A4B" strokeDasharray="3 3" />
        <line x1="168" y1="16" x2="168" y2="214" stroke="#2B3A4B" strokeDasharray="3 3" />
        <text x="40" y="28" fill="#A8B3C2" fontSize="8" fontFamily={font}>falha fechada</text>
        <text x="248" y="28" fill="#A8B3C2" fontSize="8" fontFamily={font}>autonomia →</text>
        <text x="40" y="208" fill="#A8B3C2" fontSize="8" fontFamily={font}>fundos opacos</text>
        <text x="214" y="208" fill="#A8B3C2" fontSize="8" fontFamily={font}>bots com chave</text>
        {dots.map((dot) => (
          <g key={dot.label}>
            <circle cx={dot.x} cy={dot.y} r={dot.label === "ValueCurator" ? 7 : 4.5} fill={dot.fill} />
            <text x={dot.x + 10} y={dot.y + 3} fill="#F5F7FB" fontSize="9" fontFamily={font}>{dot.label}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left font-mono text-[10px]">
          <thead className="text-stocklana-muted">
            <tr>{["", "Bot", "Multisig", "Fundo", "ValueCurator"].map((cell) => <th key={cell || "d"} className="px-1 py-1 font-medium">{cell}</th>)}</tr>
          </thead>
          <tbody className="text-white">
            {[
              ["Assina", "o modelo", "o quórum", "o gestor", "o dono"],
              ["Oráculo", "—", "—", "—", "Pyth 922"],
              ["Recusa", "não", "devagar", "no comitê", "no limite"],
              ["Recibo", "—", "a tx", "papel", "Ed25519"],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-white/10">
                {row.map((cell) => <td key={cell} className="px-1 py-1">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

export function RoadmapBoard() {
  const quarters = [
    ["T1", "Hackathon", "Programa na Devnet, feed 922, portão na tela.", "#3DDC97"],
    ["T2", "Laboratório", "Mentoria, auditoria, prova com um dono que já tem o ativo.", "#7DA2F8"],
    ["T3", "Segundo nó", "Outra carteira, outro ativo. O primeiro continua em um mint.", "#C4B5FD"],
    ["T4", "Padrão do portão", "A recusa real precede qualquer conversa de mainnet.", "#F0A0C0"],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2">
      {quarters.map(([id, title, body, color]) => (
        <article key={id} className="overflow-hidden rounded-xl border border-white/10 bg-[#0C1624]">
          <div className="h-1" style={{ background: color }} />
          <div className="p-3">
            <p className="font-mono text-[10px]" style={{ color }}>{id} 2026</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-stocklana-muted">{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AskFigure() {
  return (
    <Frame label="O que o laboratório acelera" tone="green">
      <div className="flex h-8 overflow-hidden rounded-lg font-mono text-[10px] text-[#062018]">
        <div className="flex w-[45%] items-center justify-center bg-[#3DDC97]">45% auditoria</div>
        <div className="flex w-[35%] items-center justify-center bg-[#7DA2F8]">35% engenharia</div>
        <div className="flex w-[20%] items-center justify-center bg-[#E0B96A]">20% encontro</div>
      </div>
      <div className="mt-3 rounded-xl border border-[#E0B96A]/50 p-3 text-center">
        <p className="text-sm leading-6 text-white">A IA aconselha. A evidência prova. A política autoriza. O dono governa.</p>
      </div>
    </Frame>
  );
}

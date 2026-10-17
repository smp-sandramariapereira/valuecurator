import { oracleDataFlow } from "./oracle-selector-model";
import { GlyphShapes, ORACLE_GLYPH_IDS, type OracleGlyphId } from "./oracle-glyphs";

const font = "ui-monospace, monospace";

function isGlyph(id: string): id is OracleGlyphId {
  return (ORACLE_GLYPH_IDS as readonly string[]).includes(id);
}

function RecordIcon({ id, x, y }: { id: OracleGlyphId; x: number; y: number }) {
  return (
    <svg x={x} y={y} width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
      <GlyphShapes id={id} />
    </svg>
  );
}

function NeuralNet({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const counts = [4, 6, 5, 3];
  const padX = 46;
  const padY = 28;
  const columns = counts.map((count, layer) => {
    const cx = x + padX + (layer * (width - padX * 2)) / (counts.length - 1);
    const gap = (height - padY * 2) / (count - 1);
    return Array.from({ length: count }, (_, index) => ({ cx, cy: y + padY + index * gap }));
  });
  const links = columns.slice(0, -1).flatMap((column, layer) =>
    column.flatMap((from) =>
      columns[layer + 1].map((to) => ({ from, to, layer })),
    ),
  );

  return (
    <g aria-hidden="true">
      {links.map((link, index) => (
        <line
          key={index}
          x1={link.from.cx}
          y1={link.from.cy}
          x2={link.to.cx}
          y2={link.to.cy}
          stroke={link.layer % 2 === 0 ? "#7DA2F8" : "#6BAED6"}
          strokeOpacity={0.38}
          strokeWidth="1.2"
        />
      ))}
      {columns.flatMap((column, layer) =>
        column.map((node, index) => {
          const accent = layer === counts.length - 1 || index === 1;
          return (
            <g key={`${layer}-${index}`}>
              <circle cx={node.cx} cy={node.cy} r="8" fill="#17324A" stroke={accent ? "#E0B96A" : "#7DA2F8"} strokeWidth="1.6" />
              <circle cx={node.cx} cy={node.cy} r="2.4" fill={accent ? "#E0B96A" : "#A9BBFF"} />
            </g>
          );
        }),
      )}
    </g>
  );
}

export function OracleDataFlow({ activeIds }: { activeIds: readonly string[] }) {
  const records = activeIds.filter(isGlyph);
  const shown = records.length > 0 ? records : (["pyth-pro", "pyth-hermes"] as const);
  const slot = shown.length <= 2 ? 108 : 78;
  const body = shown.length * slot;
  const panelY = 24;
  const panelH = 252;
  const top = panelY + Math.max(8, (panelH - body) / 2);
  const panelX = 468;
  const entries = [132, 168, 204];

  return (
    <figure
      aria-label="Active oracles only supply data to the calculation engine"
      className="rounded-xl border border-white/10 bg-stocklana-bg/60 p-4"
    >
      <div className="overflow-x-auto">
        <svg viewBox="0 0 860 300" className="h-auto w-full" role="img">
          <title>Active oracles stored as records, feeding the calculation engine</title>

          <ellipse cx="132" cy={top + body} rx="112" ry="16" fill="#0E1A28" stroke="#7DA2F8" strokeWidth="2" />
          <rect x="20" y={top} width="224" height={body} fill="#111D2B" />
          <line x1="20" y1={top} x2="20" y2={top + body} stroke="#7DA2F8" strokeWidth="2" />
          <line x1="244" y1={top} x2="244" y2={top + body} stroke="#7DA2F8" strokeWidth="2" />
          {shown.slice(1).map((_, index) => (
            <ellipse key={index} cx="132" cy={top + (index + 1) * slot} rx="112" ry="13" fill="none" stroke="#2B3A4B" />
          ))}
          <ellipse cx="132" cy={top} rx="112" ry="16" fill="#17324A" stroke="#7DA2F8" strokeWidth="2" />
          <text x="132" y={top + 4} textAnchor="middle" fill="#7DA2F8" fontSize="11" fontFamily={font}>oracles</text>

          {shown.map((id, index) => {
            const center = top + index * slot + slot / 2;
            const entry = entries[Math.min(index, entries.length - 1)] ?? 168;
            return (
              <g key={id}>
                <RecordIcon id={id} x={36} y={center - 17} />
                <text x="78" y={center - 2} fill="#F5F7FB" fontSize="12" fontFamily={font}>{id}</text>
                <text x="78" y={center + 14} fill="#A8B3C2" fontSize="10" fontFamily={font}>price</text>
                <path
                  d={`M244 ${center} C 330 ${center}, 400 ${entry}, ${panelX} ${entry}`}
                  fill="none"
                  stroke={index === 0 ? "#7DA2F8" : "#6BAED6"}
                  strokeWidth="2"
                />
              </g>
            );
          })}
          <text x="350" y={top + 28} textAnchor="middle" fill="#7DA2F8" fontSize="10" fontFamily={font}>{oracleDataFlow.arrow}</text>

          <rect x={panelX} y={panelY} width="372" height={panelH} rx="6" fill="#111D2B" stroke="#7DA2F8" />
          <NeuralNet x={panelX} y={panelY} width={372} height={panelH} />
        </svg>
      </div>
    </figure>
  );
}

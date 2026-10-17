export const ORACLE_GLYPH_IDS = ["pyth-pro", "pyth-hermes", "chainlink", "switchboard", "redstone"] as const;
export type OracleGlyphId = (typeof ORACLE_GLYPH_IDS)[number];
type GlyphId = OracleGlyphId | "engine";

export function isOracleGlyph(id: string): id is OracleGlyphId {
  return (ORACLE_GLYPH_IDS as readonly string[]).includes(id);
}

export function GlyphShapes({ id }: { id: Exclude<GlyphId, "engine"> }) {
  if (id === "pyth-pro") {
    return (
      <>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#7DA2F8" strokeWidth="2" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#7DA2F8" strokeWidth="2" />
        <circle cx="32" cy="32" r="4" fill="#A9BBFF" />
        <path d="M32 12v6M32 46v6M12 32h6M46 32h6" stroke="#E0B96A" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (id === "pyth-hermes") {
    return (
      <>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#6BAED6" strokeWidth="2" />
        <path d="M16 40c8-14 24-14 32 0" fill="none" stroke="#6BAED6" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 28c7-8 21-8 28 0" fill="none" stroke="#A9BBFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="22" r="3" fill="#E0B96A" />
      </>
    );
  }
  if (id === "switchboard") {
    return (
      <>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#A8B3C2" strokeWidth="2" strokeDasharray="4 3" />
        <rect x="18" y="18" width="8" height="8" rx="2" fill="none" stroke="#A8B3C2" strokeWidth="2" />
        <rect x="38" y="18" width="8" height="8" rx="2" fill="none" stroke="#A8B3C2" strokeWidth="2" />
        <rect x="18" y="38" width="8" height="8" rx="2" fill="none" stroke="#A8B3C2" strokeWidth="2" />
        <rect x="38" y="38" width="8" height="8" rx="2" fill="none" stroke="#A8B3C2" strokeWidth="2" />
      </>
    );
  }
  if (id === "redstone") {
    return (
      <>
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#A8B3C2" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M32 16l12 16-12 16-12-16z" fill="none" stroke="#A8B3C2" strokeWidth="2" strokeLinejoin="round" />
      </>
    );
  }
  return (
    <>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#A8B3C2" strokeWidth="2" strokeDasharray="4 3" />
      <path d="M24 26h10a6 6 0 0 1 0 12H24" fill="none" stroke="#A8B3C2" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 38H30a6 6 0 0 1 0-12h10" fill="none" stroke="#A8B3C2" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

export function OracleGlyph({ id, className = "h-12 w-12" }: { id: GlyphId; className?: string }) {
  if (id === "engine") {
    return (
      <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
        <rect x="4" y="4" width="56" height="56" rx="16" fill="#101C2E" stroke="#7DA2F8" strokeWidth="2" />
        <path d="M18 42V30M28 42V22M38 42V26M48 42V18" stroke="#7DA2F8" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 46h32" stroke="#E0B96A" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <GlyphShapes id={id} />
    </svg>
  );
}

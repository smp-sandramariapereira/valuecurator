import type { AuthorizationBlueprint, ResearchProfile, Session } from "../domain.js";

const UNKNOWN_PATTERNS = [
  /^i\s*(?:do\s*not|don't|dont)\s*know[.!]?$/i,
  /^not\s+sure[.!]?$/i, /^unsure[.!]?$/i, /^unknown[.!]?$/i,
  /^n\/?a[.!]?$/i, /^no\s+idea[.!]?$/i, /^não\s+sei[.!]?$/i,
  /^nao\s+sei[.!]?$/i, /^não\s+tenho\s+certeza[.!]?$/i,
  /^nao\s+tenho\s+certeza[.!]?$/i
];

export function isSubstantiveAnswer(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && !UNKNOWN_PATTERNS.some((pattern) => pattern.test(normalized));
}

const answersFor = (session: Session, states: Session["state"][]) =>
  session.answers
    .filter((answer) => states.includes(answer.state) && isSubstantiveAnswer(answer.rawAnswer))
    .map((answer) => answer.rawAnswer);

const evidenceFor = (session: Session, state: Session["state"], findings: string[]) =>
  [...new Map(session.evidence
    .filter((e) => e.sourceState === state && findings.includes(e.finding) && isSubstantiveAnswer(e.evidence))
    .map((e) => [e.source, e.evidence])).values()];

export function buildResearchProfile(session: Session): ResearchProfile {
  return {
    walletAddress: session.walletAddress,
    interviewId: session.id,
    autonomyModel: answersFor(session, ["AUTONOMY"]),
    currentControls: evidenceFor(session, "CURRENT_CONTROLS", ["manual_approval","transaction_limits","daily_exposure_limit","approved_assets","market_evidence","liquidity_control","emergency_control"]),
    concerns: answersFor(session, ["RISK","OBJECTIONS"]),
    authorizationNeeds: answersFor(session, ["AUTHORIZATION"]),
    auditabilityNeeds: answersFor(session, ["AUDITABILITY"]),
    buildVsBuySignals: answersFor(session, ["BUILD_VS_BUY"]),
    pilotInterest: session.pilotInterest
  };
}

const REQUIREMENT_FINDINGS = [
  "manual_approval","transaction_limits","daily_exposure_limit","approved_assets",
  "market_evidence","liquidity_control","auditability_requirement","emergency_control"
];

const thresholdSpecified = (session: Session, patterns: RegExp[]) =>
  session.answers.some((a) => isSubstantiveAnswer(a.rawAnswer) && patterns.some((p) => p.test(a.rawAnswer)));

export function buildAuthorizationBlueprint(session: Session): AuthorizationBlueprint {
  const requirementsMentioned = [...new Set(session.evidence
    .filter((e) => REQUIREMENT_FINDINGS.includes(e.finding))
    .filter((e) => isSubstantiveAnswer(e.evidence))
    .map((e) => e.finding))];

  // A requirement is not a quantitative threshold. "We need a daily limit"
  // remains unspecified until the participant provides an actual value/window.
  const thresholdRules: Array<[string, RegExp[]]> = [
    ["per_transaction_limit", [
      /(?:per[- ]transaction|transaction (?:limit|cap)|maximum transaction)[^\n]{0,40}(?:\$|usd|usdc|\d[\d,.]*)/i,
      /(?:\$|usd|usdc)\s*\d[\d,.]*[^\n]{0,40}(?:per[- ]transaction|transaction)/i
    ]],
    ["daily_exposure_limit", [
      /(?:daily exposure|daily (?:limit|cap))[^\n]{0,40}(?:\$|usd|usdc|%|\d[\d,.]*)/i,
      /(?:\$|usd|usdc|%)\s*\d[\d,.]*[^\n]{0,40}daily/i
    ]],
    ["maximum_evidence_age", [/(?:evidence age|market data|oracle|quote)[^\n]{0,40}\b\d+\s*(?:seconds?|secs?|minutes?|mins?|hours?)\b/i]],
    ["maximum_source_deviation", [/(?:source deviation|oracle deviation|price deviation)[^\n]{0,40}\b\d+(?:\.\d+)?\s*%/i]],
    ["maximum_price_impact", [/(?:price impact|slippage)[^\n]{0,40}\b\d+(?:\.\d+)?\s*%/i]]
  ];

  const missingThresholds = thresholdRules
    .filter(([, patterns]) => !thresholdSpecified(session, patterns))
    .map(([key]) => key);

  return {
    status: "NON_BINDING_RESEARCH_ARTIFACT",
    interviewId: session.id,
    controlsMentioned: requirementsMentioned,
    requirementsMentioned,
    missingThresholds,
    disclaimer: "Generated from interview responses for research purposes. Not financial, legal, security, or execution authorization."
  };
}

import type { Answer, Evidence, InterviewState } from "../domain.js";

type Rule = {
  finding: string;
  states: InterviewState[];
  re: RegExp;
};

// Extraction is state-scoped: lexical overlap in another interview stage must
// never silently reclassify a participant statement into a different dimension.
const rules: Rule[] = [
  { finding: "manual_approval", states: ["AUTONOMY","CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(manual|human|multisig|approve|approval)\b/i },
  { finding: "transaction_limits", states: ["CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(per[- ]transaction|transaction limits?|trade limits?|transaction cap|maximum transaction)\b/i },
  { finding: "daily_exposure_limit", states: ["CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(daily exposure|daily limit|daily cap)\b/i },
  { finding: "approved_assets", states: ["CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(approved assets?|allowed assets?|allowlisted assets?|asset allowlist)\b/i },
  { finding: "market_evidence", states: ["CURRENT_CONTROLS","AUTHORIZATION","AUDITABILITY"], re: /\b(oracle|market data|pyth|price quote|market evidence|fresh market evidence)\b/i },
  { finding: "liquidity_control", states: ["CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(liquidity|slippage|price impact)\b/i },
  { finding: "auditability_requirement", states: ["AUDITABILITY"], re: /\b(audit|audit trail|log|trace|receipt|evidence|policy checks?|approved|blocked)\b/i },
  { finding: "emergency_control", states: ["CURRENT_CONTROLS","AUTHORIZATION"], re: /\b(pause|freeze|emergency|circuit breaker)\b/i },
  { finding: "pilot_interest_positive", states: ["PILOT_INTEREST"], re: /\b(yes|sim|interested|would test|open to|shadow[- ]mode pilot)\b/i }
];

export function extractEvidence(answer: Answer): Evidence[] {
  return rules
    .filter(({ states, re }) => states.includes(answer.state) && re.test(answer.rawAnswer))
    .map(({ finding }) => ({
      finding,
      evidence: answer.rawAnswer.slice(0, 500),
      source: answer.id,
      sourceState: answer.state,
      confidence: 1
    }));
}

import type { InterviewState } from "../domain.js";

export const PROTOCOL_VERSION = "customer-discovery-v1";
export const PROMPT_VERSION = "interviewer-v1";
export const EVIDENCE_SCHEMA_VERSION = "evidence-v2";

export const QUESTIONS: Record<Exclude<InterviewState, "COMPLETE">, string> = {
  CONSENT: "Do you consent to participate in this research interview and to have your responses stored for product research?",
  CONTEXT: "What are you building or operating, and what role do autonomous or AI-driven financial actions play in it today?",
  AUTONOMY: "What financial actions can your system take without a person approving each action?",
  CURRENT_CONTROLS: "What controls do you currently use before an automated financial action can proceed?",
  RISK: "What would make you refuse to let an autonomous system execute a financial action?",
  AUTHORIZATION: "How do you decide whether a proposed action is authorized, and which limits or evidence matter most?",
  AUDITABILITY: "After an automated decision, what evidence or audit trail do you need to understand why it was allowed or blocked?",
  BUILD_VS_BUY: "Which authorization or risk controls would you build internally, and which would you consider using as infrastructure?",
  VALUECURATOR_REVEAL: "ValueCurator separates AI advice from deterministic authorization and custody. Where, if anywhere, would that model fit your workflow?",
  OBJECTIONS: "What would prevent you from using an evidence-gated authorization layer like this?",
  PILOT_INTEREST: "Would you consider testing this in shadow mode, where decisions are evaluated but no capital is moved?"
};

export function nextState(state: InterviewState): InterviewState {
  const order: InterviewState[] = [
    "CONSENT","CONTEXT","AUTONOMY","CURRENT_CONTROLS","RISK","AUTHORIZATION",
    "AUDITABILITY","BUILD_VS_BUY","VALUECURATOR_REVEAL","OBJECTIONS",
    "PILOT_INTEREST","COMPLETE"
  ];
  return order[Math.min(order.indexOf(state) + 1, order.length - 1)];
}

export function questionFor(state: InterviewState): string | null {
  return state === "COMPLETE" ? null : QUESTIONS[state];
}

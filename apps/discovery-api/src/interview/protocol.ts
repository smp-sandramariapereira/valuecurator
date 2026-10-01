import type { InterviewState } from "../domain.js";

export const PROTOCOL_VERSION = "customer-discovery-v2";
export const PROMPT_VERSION = "interviewer-v2";
export const EVIDENCE_SCHEMA_VERSION = "evidence-v2";

export const QUESTIONS: Record<Exclude<InterviewState, "COMPLETE">, string> = {
  CONSENT: "Do you consent to participate in this research interview and to have your responses stored for product research?",
  CONTEXT: "What do you operate today: a business that allocates capital, an agent or runtime that proposes financial actions, or both? Describe the last time that system was involved in a financial action.",
  AUTONOMY: "In the last month, which financial actions went ahead without a person approving each one?",
  CURRENT_CONTROLS: "What check stopped or allowed that action before any funds moved?",
  RISK: "Describe the last time you refused an automated financial action. What made you refuse?",
  AUTHORIZATION: "Who is allowed to approve an action in your organization, and which limit did they apply last time?",
  AUDITABILITY: "After the last allowed or blocked action, what record did you keep, and who read it?",
  BUILD_VS_BUY: "Which of those controls does your team run itself, and which do you pay another party to provide?",
  VALUECURATOR_REVEAL: "ValueCurator keeps AI advice separate from deterministic authorization and from custody. Where, if anywhere, would that sit in the workflow you described?",
  OBJECTIONS: "What would stop you from relying on an outside authorization layer for that workflow?",
  PILOT_INTEREST: "Would you test this in shadow mode, where the decision is recorded and no capital moves? Reply yes or no, and name who else would have to agree."
};

/** Explicit pilot signal. The opening yes or no decides; a later "no one else" does not overturn a yes. */
export function explicitPilotInterest(answer: string): boolean | undefined {
  const text = answer.trim();
  if (/^(yes|y|sim|s)\b/i.test(text)) return true;
  if (/^(no|nao)\b/i.test(text) || /^não(?:\s|$|[,.])/i.test(text)) return false;
  if (/not interested|não tenho interesse|nao tenho interesse|would not|wouldn't|will not/i.test(text)) {
    return false;
  }
  if (/\b(i am interested|i'm interested|interessado|interessada)\b/i.test(text)) return true;
  return undefined;
}

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

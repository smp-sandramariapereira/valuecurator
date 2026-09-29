import { z } from "zod";

/**
 * Shared Discovery interview state machine.
 *
 * Order is part of the product contract:
 * CONSENT → CONTEXT → AUTONOMY → CURRENT_CONTROLS → RISK → AUTHORIZATION →
 * AUDITABILITY → BUILD_VS_BUY → VALUECURATOR_REVEAL → OBJECTIONS →
 * PILOT_INTEREST → COMPLETE
 *
 * Further shared schemas (Answer, Evidence, ResearchProfile,
 * AuthorizationBlueprint, API envelopes) remain in apps/discovery-api until
 * a dedicated extraction pass. Do not force abstraction for aesthetics.
 */
export const InterviewStateSchema = z.enum([
  "CONSENT",
  "CONTEXT",
  "AUTONOMY",
  "CURRENT_CONTROLS",
  "RISK",
  "AUTHORIZATION",
  "AUDITABILITY",
  "BUILD_VS_BUY",
  "VALUECURATOR_REVEAL",
  "OBJECTIONS",
  "PILOT_INTEREST",
  "COMPLETE",
]);

export type InterviewState = z.infer<typeof InterviewStateSchema>;

export const STATES: InterviewState[] = InterviewStateSchema.options;

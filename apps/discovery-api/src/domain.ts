import { z } from "zod";
import {
  InterviewStateSchema,
  STATES,
  type InterviewState,
} from "@valuecurator/discovery-contracts";

export { InterviewStateSchema, STATES, type InterviewState };

export const AnswerSchema = z.object({
  id: z.string(),
  state: InterviewStateSchema,
  question: z.string(),
  rawAnswer: z.string().min(1).max(8000),
  createdAt: z.string()
});
export type Answer = z.infer<typeof AnswerSchema>;

export const EvidenceSchema = z.object({
  finding: z.string().min(1),
  evidence: z.string().min(1),
  source: z.string().min(1),
  sourceState: InterviewStateSchema,
  confidence: z.number().min(0).max(1)
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  state: InterviewStateSchema,
  consented: z.boolean(),
  protocolVersion: z.string(),
  promptVersion: z.string(),
  evidenceSchemaVersion: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  answers: z.array(AnswerSchema),
  evidence: z.array(EvidenceSchema),
  pilotInterest: z.boolean().optional()
});
export type Session = z.infer<typeof SessionSchema>;

export type ResearchProfile = {
  walletAddress: string;
  interviewId: string;
  autonomyModel: string[];
  currentControls: string[];
  concerns: string[];
  authorizationNeeds: string[];
  auditabilityNeeds: string[];
  buildVsBuySignals: string[];
  pilotInterest?: boolean;
};

export type AuthorizationBlueprint = {
  status: "NON_BINDING_RESEARCH_ARTIFACT";
  interviewId: string;
  controlsMentioned: string[];
  requirementsMentioned: string[];
  missingThresholds: string[];
  disclaimer: string;
};

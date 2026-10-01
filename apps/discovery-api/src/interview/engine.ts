import crypto from "node:crypto";
import type { Session } from "../domain.js";
import { extractEvidence } from "../evidence/extractor.js";
import { buildAuthorizationBlueprint, buildResearchProfile } from "../research/profile.js";
import type { SessionRepository } from "../storage/repository.js";
import {
  EVIDENCE_SCHEMA_VERSION, PROMPT_VERSION, PROTOCOL_VERSION, explicitPilotInterest, nextState, questionFor
} from "./protocol.js";
import { classifySession } from "../research/audience.js";

export class InterviewEngine {
  constructor(private readonly repository: SessionRepository) {}

  async start(walletAddress: string): Promise<Session> {
    const existing = await this.repository.findByWallet(walletAddress);
    const previous = existing.find((session) => session.protocolVersion === PROTOCOL_VERSION) ?? existing[0];
    if (previous) return previous;

    const session: Session = {
      id: crypto.randomUUID(),
      walletAddress,
      state: "CONSENT",
      consented: false,
      protocolVersion: PROTOCOL_VERSION,
      promptVersion: PROMPT_VERSION,
      evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
      startedAt: new Date().toISOString(),
      answers: [],
      evidence: []
    };
    await this.repository.save(session);
    return session;
  }

  async answer(sessionId: string, rawAnswer: string) {
    const session = await this.repository.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.state === "COMPLETE") throw new Error("Interview already complete");

    const currentState = session.state;
    const normalized = rawAnswer.trim();
    if (!normalized) throw new Error("Answer is required");

    if (currentState === "CONSENT") {
      const consented = /^(yes|y|sim|s|i consent|concordo|aceito)\b/i.test(normalized);
      if (!consented) throw new Error("Explicit consent is required to continue");
      session.consented = true;
    }

    const answer = {
      id: `answer_${String(session.answers.length + 1).padStart(2, "0")}`,
      state: currentState,
      question: questionFor(currentState) ?? "",
      rawAnswer: normalized,
      createdAt: new Date().toISOString()
    };

    session.answers.push(answer);
    session.evidence.push(...extractEvidence(answer));

    if (currentState === "PILOT_INTEREST") {
      session.pilotInterest = explicitPilotInterest(normalized);
    }

    session.state = nextState(currentState);
    if (session.state === "COMPLETE") session.completedAt = new Date().toISOString();
    await this.repository.save(session);

    return this.view(session);
  }

  async viewById(sessionId: string) {
    const session = await this.repository.get(sessionId);
    if (!session) throw new Error("Session not found");
    return this.view(session);
  }

  private view(session: Session) {
    return {
      session,
      nextQuestion: questionFor(session.state),
      audience: classifySession(session),
      ...(session.state === "COMPLETE" ? {
        researchProfile: buildResearchProfile(session),
        authorizationBlueprint: buildAuthorizationBlueprint(session)
      } : {})
    };
  }
}

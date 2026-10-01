import { asc, eq } from "drizzle-orm";
import type { Answer, Evidence, InterviewState, Session } from "../domain.js";
import { InterviewStateSchema } from "../domain.js";
import type { DiscoveryDb } from "../db/types.js";
import { interviewAnswers, interviewEvidence, interviewSessions } from "../db/schema.js";
import type { SessionRepository } from "./repository.js";

function parseState(value: string): InterviewState {
  return InterviewStateSchema.parse(value);
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: DiscoveryDb) {}

  async save(session: Session): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(interviewSessions)
        .values({
          id: session.id,
          walletAddress: session.walletAddress,
          state: session.state,
          consented: session.consented,
          protocolVersion: session.protocolVersion,
          promptVersion: session.promptVersion,
          evidenceSchemaVersion: session.evidenceSchemaVersion,
          startedAt: new Date(session.startedAt),
          completedAt: session.completedAt ? new Date(session.completedAt) : null,
          pilotInterest: session.pilotInterest ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: interviewSessions.id,
          set: {
            walletAddress: session.walletAddress,
            state: session.state,
            consented: session.consented,
            protocolVersion: session.protocolVersion,
            promptVersion: session.promptVersion,
            evidenceSchemaVersion: session.evidenceSchemaVersion,
            startedAt: new Date(session.startedAt),
            completedAt: session.completedAt ? new Date(session.completedAt) : null,
            pilotInterest: session.pilotInterest ?? null,
            updatedAt: new Date(),
          },
        });

      await tx.delete(interviewAnswers).where(eq(interviewAnswers.sessionId, session.id));
      await tx.delete(interviewEvidence).where(eq(interviewEvidence.sessionId, session.id));

      if (session.answers.length > 0) {
        await tx.insert(interviewAnswers).values(
          session.answers.map((answer, index) => ({
            sessionId: session.id,
            id: answer.id,
            state: answer.state,
            question: answer.question,
            rawAnswer: answer.rawAnswer,
            createdAt: new Date(answer.createdAt),
            sequence: index,
          })),
        );
      }

      if (session.evidence.length > 0) {
        await tx.insert(interviewEvidence).values(
          session.evidence.map((item, index) => ({
            sessionId: session.id,
            finding: item.finding,
            evidence: item.evidence,
            source: item.source,
            sourceState: item.sourceState,
            confidence: item.confidence,
            sequence: index,
          })),
        );
      }
    });
  }

  async get(id: string): Promise<Session | null> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.hydrate(row);
  }

  async findByWallet(walletAddress: string): Promise<Session[]> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.walletAddress, walletAddress));
    const sessions: Session[] = [];
    for (const row of rows) {
      sessions.push(await this.hydrate(row));
    }
    return sessions;
  }

  async list(): Promise<Session[]> {
    const rows = await this.db
      .select()
      .from(interviewSessions)
      .orderBy(asc(interviewSessions.startedAt));
    const sessions: Session[] = [];
    for (const row of rows) {
      sessions.push(await this.hydrate(row));
    }
    return sessions;
  }

  private async hydrate(row: typeof interviewSessions.$inferSelect): Promise<Session> {
    const answersRows = await this.db
      .select()
      .from(interviewAnswers)
      .where(eq(interviewAnswers.sessionId, row.id))
      .orderBy(asc(interviewAnswers.sequence));

    const evidenceRows = await this.db
      .select()
      .from(interviewEvidence)
      .where(eq(interviewEvidence.sessionId, row.id))
      .orderBy(asc(interviewEvidence.sequence));

    const answers: Answer[] = answersRows.map((answer) => ({
      id: answer.id,
      state: parseState(answer.state),
      question: answer.question,
      rawAnswer: answer.rawAnswer,
      createdAt: answer.createdAt.toISOString(),
    }));

    const evidence: Evidence[] = evidenceRows.map((item) => ({
      finding: item.finding,
      evidence: item.evidence,
      source: item.source,
      sourceState: parseState(item.sourceState),
      confidence: item.confidence,
    }));

    const session: Session = {
      id: row.id,
      walletAddress: row.walletAddress,
      state: parseState(row.state),
      consented: row.consented,
      protocolVersion: row.protocolVersion,
      promptVersion: row.promptVersion,
      evidenceSchemaVersion: row.evidenceSchemaVersion,
      startedAt: row.startedAt.toISOString(),
      answers,
      evidence,
    };

    if (row.completedAt) session.completedAt = row.completedAt.toISOString();
    if (row.pilotInterest !== null) session.pilotInterest = row.pilotInterest;

    return session;
  }
}

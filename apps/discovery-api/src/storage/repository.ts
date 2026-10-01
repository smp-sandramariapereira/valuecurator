import type { Session } from "../domain.js";

export interface SessionRepository {
  save(session: Session): Promise<void>;
  get(id: string): Promise<Session | null>;
  findByWallet(walletAddress: string): Promise<Session[]>;
  list(): Promise<Session[]>;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async get(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async findByWallet(walletAddress: string): Promise<Session[]> {
    return [...this.sessions.values()]
      .filter((s) => s.walletAddress === walletAddress)
      .map((s) => structuredClone(s));
  }

  async list(): Promise<Session[]> {
    return [...this.sessions.values()].map((session) => structuredClone(session));
  }
}

import { eq } from "drizzle-orm";
import type { DiscoveryDb } from "../db/types.js";
import { authChallenges } from "../db/schema.js";
import type { AuthChallenge, ChallengeStore } from "./challenge-store.js";

export class PostgresChallengeStore implements ChallengeStore {
  constructor(private readonly db: DiscoveryDb) {}

  async put(walletAddress: string, challenge: AuthChallenge): Promise<void> {
    await this.db
      .insert(authChallenges)
      .values({
        walletAddress,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: new Date(challenge.expiresAt),
      })
      .onConflictDoUpdate({
        target: authChallenges.walletAddress,
        set: {
          nonce: challenge.nonce,
          message: challenge.message,
          expiresAt: new Date(challenge.expiresAt),
          createdAt: new Date(),
        },
      });
  }

  async get(walletAddress: string): Promise<AuthChallenge | null> {
    const rows = await this.db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.walletAddress, walletAddress))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      nonce: row.nonce,
      message: row.message,
      expiresAt: row.expiresAt.getTime(),
    };
  }

  async delete(walletAddress: string): Promise<void> {
    await this.db.delete(authChallenges).where(eq(authChallenges.walletAddress, walletAddress));
  }
}

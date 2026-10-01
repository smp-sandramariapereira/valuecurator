export type AuthChallenge = {
  nonce: string;
  message: string;
  expiresAt: number;
};

export interface ChallengeStore {
  put(walletAddress: string, challenge: AuthChallenge): Promise<void>;
  get(walletAddress: string): Promise<AuthChallenge | null>;
  delete(walletAddress: string): Promise<void>;
}

export class InMemoryChallengeStore implements ChallengeStore {
  private readonly challenges = new Map<string, AuthChallenge>();

  async put(walletAddress: string, challenge: AuthChallenge): Promise<void> {
    this.challenges.set(walletAddress, challenge);
  }

  async get(walletAddress: string): Promise<AuthChallenge | null> {
    return this.challenges.get(walletAddress) ?? null;
  }

  async delete(walletAddress: string): Promise<void> {
    this.challenges.delete(walletAddress);
  }
}

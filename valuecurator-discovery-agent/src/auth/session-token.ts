import crypto from "node:crypto";

type TokenPayload = { walletAddress: string; sessionId: string; exp: number };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be at least 32 characters");
    return "dev-only-valuecurator-discovery-secret";
  }
  return value;
}

function b64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function issueSessionToken(walletAddress: string, sessionId: string, ttlMinutes = 60): string {
  const payload: TokenPayload = { walletAddress, sessionId, exp: Date.now() + ttlMinutes * 60_000 };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string, expectedSessionId: string): TokenPayload | null {
  const [body, supplied] = token.split(".");
  if (!body || !supplied) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest();
  let actual: Buffer;
  try { actual = Buffer.from(supplied, "base64url"); } catch { return null; }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (payload.exp < Date.now() || payload.sessionId !== expectedSessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

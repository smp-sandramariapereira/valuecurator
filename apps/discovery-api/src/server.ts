import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { createChallenge, verifyChallenge } from "./auth/solana.js";
import { issueSessionToken, verifySessionToken } from "./auth/session-token.js";
import { InterviewEngine } from "./interview/engine.js";
import { InMemorySessionRepository } from "./storage/repository.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:43147" });

const repository = new InMemorySessionRepository();
const engine = new InterviewEngine(repository);

const WalletSchema = z.object({ walletAddress: z.string().min(32).max(64) });
const VerifySchema = WalletSchema.extend({ nonce: z.string().min(16), signature: z.string().min(32) });
const AnswerBodySchema = z.object({ answer: z.string().min(1).max(8000) });

function bearer(request: { headers: { authorization?: string } }): string | null {
  const value = request.headers.authorization;
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

function authorize(request: { headers: { authorization?: string } }, sessionId: string): boolean {
  const token = bearer(request);
  return Boolean(token && verifySessionToken(token, sessionId));
}

app.get("/health", async () => ({ ok: true, service: "valuecurator-discovery-agent" }));

app.post("/auth/challenge", async (request, reply) => {
  try {
    const { walletAddress } = WalletSchema.parse(request.body);
    return createChallenge(walletAddress);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

app.post("/auth/verify", async (request, reply) => {
  try {
    const { walletAddress, nonce, signature } = VerifySchema.parse(request.body);
    if (!verifyChallenge(walletAddress, nonce, signature)) {
      return reply.code(401).send({ error: "Invalid or expired signature" });
    }
    const session = await engine.start(walletAddress);
    const token = issueSessionToken(walletAddress, session.id, Number(process.env.SESSION_TTL_MINUTES ?? 60));
    return { authenticated: true, sessionId: session.id, state: session.state, token };
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

app.get("/interviews/:id", async (request, reply) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!authorize(request, id)) return reply.code(401).send({ error: "Unauthorized" });
    return await engine.viewById(id);
  } catch (error) {
    return reply.code(404).send({ error: error instanceof Error ? error.message : "Not found" });
  }
});

app.post("/interviews/:id/answers", async (request, reply) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    if (!authorize(request, id)) return reply.code(401).send({ error: "Unauthorized" });
    const { answer } = AnswerBodySchema.parse(request.body);
    return await engine.answer(id, answer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const status = message === "Session not found" ? 404 : 400;
    return reply.code(status).send({ error: message });
  }
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, describe, expect, it } from "vitest";
import { PostgresChallengeStore } from "../src/auth/postgres-challenge-store.js";
import * as schema from "../src/db/schema.js";
import { InterviewEngine } from "../src/interview/engine.js";
import { PostgresSessionRepository } from "../src/storage/postgres-session-repository.js";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");

async function openDb(dataDir: string) {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { client, db };
}

describe("PostgresSessionRepository persistence", () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-discovery-pg-"));
  let client: PGlite | null = null;

  afterAll(async () => {
    if (client) await client.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("persists answers and evidence transactionally", async () => {
    const opened = await openDb(dataDir);
    client = opened.client;
    const repository = new PostgresSessionRepository(opened.db);
    const engine = new InterviewEngine(repository);

    const session = await engine.start("wallet-persist-1");
    await engine.answer(session.id, "yes");
    const view = await engine.answer(session.id, "We build an autonomous treasury agent.");

    expect(view.session.state).toBe("AUTONOMY");
    expect(view.session.answers).toHaveLength(2);
    expect(view.session.consented).toBe(true);

    const reloaded = await repository.get(session.id);
    expect(reloaded?.answers.map((a) => a.rawAnswer)).toEqual([
      "yes",
      "We build an autonomous treasury agent.",
    ]);
    expect(reloaded?.state).toBe("AUTONOMY");
  });

  it("survives process restart against the same database files", async () => {
    if (client) {
      await client.close();
      client = null;
    }

    const reopened = await openDb(dataDir);
    client = reopened.client;
    const repository = new PostgresSessionRepository(reopened.db);
    const engine = new InterviewEngine(repository);

    const resumed = await engine.start("wallet-persist-1");
    expect(resumed.state).toBe("AUTONOMY");
    expect(resumed.answers).toHaveLength(2);

    const view = await engine.answer(resumed.id, "Human approval is required.");
    expect(view.session.state).toBe("CURRENT_CONTROLS");
    expect(view.session.evidence.some((e) => e.sourceState === "AUTONOMY")).toBe(true);

    if (client) {
      await client.close();
      client = null;
    }

    const afterRestart = await openDb(dataDir);
    client = afterRestart.client;
    const repository2 = new PostgresSessionRepository(afterRestart.db);
    const again = await repository2.get(resumed.id);
    expect(again?.state).toBe("CURRENT_CONTROLS");
    expect(again?.answers).toHaveLength(3);
  });

  it("persists auth challenges and deletes them after consumption path", async () => {
    if (!client) {
      const opened = await openDb(dataDir);
      client = opened.client;
    }
    const db = drizzle(client, { schema });
    const store = new PostgresChallengeStore(db);
    const expiresAt = Date.now() + 60_000;
    await store.put("WalletChallenge111111111111111111111111111", {
      nonce: "a".repeat(32),
      message: "test-message",
      expiresAt,
    });
    const loaded = await store.get("WalletChallenge111111111111111111111111111");
    expect(loaded?.message).toBe("test-message");
    await store.delete("WalletChallenge111111111111111111111111111");
    expect(await store.get("WalletChallenge111111111111111111111111111")).toBeNull();
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DiscoveryDb } from "./types.js";
import * as schema from "./schema.js";

export type FileDatabase = {
  db: DiscoveryDb;
  close: () => Promise<void>;
  dataDir: string;
};

export async function createFileDatabase(dataDir: string): Promise<FileDatabase> {
  const resolved = path.resolve(dataDir);
  fs.mkdirSync(resolved, { recursive: true });
  const client = new PGlite(resolved);
  const db = drizzle(client, { schema });
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  await migrate(db, { migrationsFolder });
  return {
    db,
    dataDir: resolved,
    close: () => client.close(),
  };
}

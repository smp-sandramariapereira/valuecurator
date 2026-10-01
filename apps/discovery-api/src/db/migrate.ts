import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDatabase, createDatabase } from "./client.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  const resources = createDatabase(databaseUrl);
  try {
    await migrate(resources.db, { migrationsFolder });
    console.log("Migrations applied successfully");
  } finally {
    await closeDatabase(resources);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

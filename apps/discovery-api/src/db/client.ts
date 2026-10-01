import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type PostgresDiscoveryDb = PostgresJsDatabase<typeof schema>;

export type DiscoveryDatabase = {
  db: PostgresDiscoveryDb;
  client: postgres.Sql;
};

export function createDatabase(connectionString: string): DiscoveryDatabase {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function closeDatabase(resources: { client: postgres.Sql }) {
  await resources.client.end({ timeout: 5 });
}

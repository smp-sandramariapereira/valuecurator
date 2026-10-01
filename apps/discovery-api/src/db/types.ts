import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type DiscoveryDb =
  | PostgresJsDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

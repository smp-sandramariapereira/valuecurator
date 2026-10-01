import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  state: text("state").notNull(),
  consented: boolean("consented").notNull().default(false),
  protocolVersion: text("protocol_version").notNull(),
  promptVersion: text("prompt_version").notNull(),
  evidenceSchemaVersion: text("evidence_schema_version").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // null = not yet answered / ambiguous; true/false = explicit signal
  pilotInterest: boolean("pilot_interest"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviewAnswers = pgTable(
  "interview_answers",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    state: text("state").notNull(),
    question: text("question").notNull(),
    rawAnswer: text("raw_answer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    sequence: integer("sequence").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.id] })],
);

export const interviewEvidence = pgTable("interview_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => interviewSessions.id, { onDelete: "cascade" }),
  finding: text("finding").notNull(),
  evidence: text("evidence").notNull(),
  source: text("source").notNull(),
  sourceState: text("source_state").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  sequence: integer("sequence").notNull(),
});

export const authChallenges = pgTable("auth_challenges", {
  walletAddress: text("wallet_address").primaryKey(),
  nonce: text("nonce").notNull(),
  message: text("message").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

CREATE TABLE "auth_challenges" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_answers" (
	"session_id" uuid NOT NULL,
	"id" text NOT NULL,
	"state" text NOT NULL,
	"question" text NOT NULL,
	"raw_answer" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"sequence" integer NOT NULL,
	CONSTRAINT "interview_answers_session_id_id_pk" PRIMARY KEY("session_id","id")
);
--> statement-breakpoint
CREATE TABLE "interview_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"finding" text NOT NULL,
	"evidence" text NOT NULL,
	"source" text NOT NULL,
	"source_state" text NOT NULL,
	"confidence" double precision NOT NULL,
	"sequence" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"state" text NOT NULL,
	"consented" boolean DEFAULT false NOT NULL,
	"protocol_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"evidence_schema_version" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"pilot_interest" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_evidence" ADD CONSTRAINT "interview_evidence_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;
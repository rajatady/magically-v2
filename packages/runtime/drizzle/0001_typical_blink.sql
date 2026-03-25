CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"function_name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_source" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"compute_provider" text,
	"exit_code" integer,
	"result" jsonb,
	"error" text,
	"logs" jsonb,
	"duration_ms" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
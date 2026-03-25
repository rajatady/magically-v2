CREATE TABLE "agent_secrets" (
	"agent_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "agent_secrets_agent_id_key_pk" PRIMARY KEY("agent_id","key")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"author" text,
	"manifest_path" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_events" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"audio_url" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zeus_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"messages" jsonb NOT NULL,
	"mode" text DEFAULT 'chat' NOT NULL,
	"agent_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zeus_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "zeus_memory_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "zeus_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"goal" text NOT NULL,
	"context" jsonb,
	"deliverables" jsonb,
	"priority" text DEFAULT 'normal' NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"callback_endpoint" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_secrets" ADD CONSTRAINT "agent_secrets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_events" ADD CONSTRAINT "feed_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
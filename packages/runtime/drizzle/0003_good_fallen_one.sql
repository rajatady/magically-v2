CREATE TABLE "registry_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"author_id" text NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"latest_version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registry_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"bundle_url" text,
	"image_ref" text,
	"changelog" text,
	"status" text DEFAULT 'live' NOT NULL,
	"published_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_agent_installs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"installed_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registry_agents" ADD CONSTRAINT "registry_agents_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registry_versions" ADD CONSTRAINT "registry_versions_agent_id_registry_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."registry_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_installs" ADD CONSTRAINT "user_agent_installs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_agent_installs" ADD CONSTRAINT "user_agent_installs_agent_id_registry_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."registry_agents"("id") ON DELETE no action ON UPDATE no action;
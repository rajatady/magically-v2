CREATE TABLE "user_widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"size" text DEFAULT 'medium' NOT NULL,
	"html" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_widgets" ADD CONSTRAINT "user_widgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
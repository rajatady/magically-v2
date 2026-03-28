CREATE TABLE "zeus_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"blocks" text,
	"sdk_uuid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zeus_conversations" ALTER COLUMN "messages" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zeus_conversations" ADD COLUMN "rewind_to_sdk_uuid" text;--> statement-breakpoint
ALTER TABLE "zeus_messages" ADD CONSTRAINT "zeus_messages_conversation_id_zeus_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."zeus_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_zeus_messages_conversation" ON "zeus_messages" ("conversation_id", "created_at");
ALTER TABLE "registry_versions" ALTER COLUMN "status" SET DEFAULT 'processing';--> statement-breakpoint
ALTER TABLE "registry_versions" ADD COLUMN "build_error" text;
ALTER TABLE "workflow_runs" RENAME COLUMN "raw_product_text" TO "topic";--> statement-breakpoint
ALTER TABLE "step_versions" ADD COLUMN "parent_version_id" integer;--> statement-breakpoint
ALTER TABLE "step_versions" ADD CONSTRAINT "step_versions_parent_version_id_step_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."step_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "published_podcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_run_id" integer NOT NULL,
	"approved_version_id" integer NOT NULL,
	"approved_by" text DEFAULT 'Moderator' NOT NULL,
	"final_script" text NOT NULL,
	"word_count" integer NOT NULL,
	"estimated_duration_seconds" integer NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "published_podcasts" ADD CONSTRAINT "published_podcasts_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_podcasts" ADD CONSTRAINT "published_podcasts_approved_version_id_step_versions_id_fk" FOREIGN KEY ("approved_version_id") REFERENCES "public"."step_versions"("id") ON DELETE cascade ON UPDATE no action;

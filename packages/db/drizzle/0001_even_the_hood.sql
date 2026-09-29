CREATE TABLE "workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_product_text" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"current_step" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_run_id" integer NOT NULL,
	"step_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"current_version" integer,
	"approved_version" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_step_id" integer NOT NULL,
	"version" integer NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb NOT NULL,
	"human_feedback" text,
	"validation_status" text DEFAULT 'valid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "system_events" ADD COLUMN "workflow_run_id" integer;--> statement-breakpoint
ALTER TABLE "system_events" ADD COLUMN "metadata_json" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_versions" ADD CONSTRAINT "step_versions_workflow_step_id_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."workflow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE set null ON UPDATE no action;
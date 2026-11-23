CREATE TABLE "part_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_id" integer NOT NULL,
	"occurrence_key" text NOT NULL,
	"status" text NOT NULL,
	"updated_by" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "part_status_part_id_occurrence_key_unique" UNIQUE("part_id","occurrence_key")
);
--> statement-breakpoint
CREATE TABLE "task_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"title" text NOT NULL,
	"assignee_id" integer,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_weekday" integer;--> statement-breakpoint
ALTER TABLE "part_status" ADD CONSTRAINT "part_status_part_id_task_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."task_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_status" ADD CONSTRAINT "part_status_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_parts" ADD CONSTRAINT "task_parts_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_parts" ADD CONSTRAINT "task_parts_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
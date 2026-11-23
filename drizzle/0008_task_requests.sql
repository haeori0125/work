CREATE TABLE "task_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"wanted_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"task_id" integer
);
--> statement-breakpoint
ALTER TABLE "task_requests" ADD CONSTRAINT "task_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_requests" ADD CONSTRAINT "task_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_requests" ADD CONSTRAINT "task_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_requests_status" ON "task_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_requests_requester" ON "task_requests" USING btree ("requester_id");
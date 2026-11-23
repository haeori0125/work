CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment_id" integer NOT NULL,
	"edited_by" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"old_clock_in" timestamp with time zone NOT NULL,
	"old_clock_out" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"theme_h" integer DEFAULT 232 NOT NULL,
	"theme_s" integer DEFAULT 55 NOT NULL,
	"theme_l" integer DEFAULT 76 NOT NULL,
	"theme_hex" text,
	"week_start" text DEFAULT 'mon' NOT NULL,
	"doing_hex" text,
	"done_hex" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_edits" ADD CONSTRAINT "segment_edits_segment_id_work_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."work_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_edits" ADD CONSTRAINT "segment_edits_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_user" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_segments_user_date" ON "work_segments" USING btree ("user_id","date");
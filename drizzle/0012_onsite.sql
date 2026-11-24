CREATE TABLE "onsite_base" (
	"term" text NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "onsite_base_term_weekday_slot_user_id_pk" PRIMARY KEY("term","weekday","slot","user_id")
);
--> statement-breakpoint
CREATE TABLE "onsite_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"slot" text NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "onsite_changes_one" UNIQUE("date","slot","user_id")
);
--> statement-breakpoint
ALTER TABLE "onsite_base" ADD CONSTRAINT "onsite_base_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_changes" ADD CONSTRAINT "onsite_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_changes" ADD CONSTRAINT "onsite_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onsite_changes_date" ON "onsite_changes" USING btree ("date");
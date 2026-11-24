CREATE TABLE "onsite_lecture_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lecture_id" integer NOT NULL,
	"date" text NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "onsite_lecture_changes_one" UNIQUE("lecture_id","date","user_id")
);
--> statement-breakpoint
CREATE TABLE "onsite_lecture_staff" (
	"lecture_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "onsite_lecture_staff_lecture_id_user_id_pk" PRIMARY KEY("lecture_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "onsite_lectures" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onsite_lecture_changes" ADD CONSTRAINT "onsite_lecture_changes_lecture_id_onsite_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."onsite_lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_lecture_changes" ADD CONSTRAINT "onsite_lecture_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_lecture_changes" ADD CONSTRAINT "onsite_lecture_changes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_lecture_staff" ADD CONSTRAINT "onsite_lecture_staff_lecture_id_onsite_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."onsite_lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_lecture_staff" ADD CONSTRAINT "onsite_lecture_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onsite_lecture_changes_date" ON "onsite_lecture_changes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "onsite_lectures_range" ON "onsite_lectures" USING btree ("start_date","end_date");
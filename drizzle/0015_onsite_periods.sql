CREATE TABLE "onsite_period_staff" (
	"period_id" integer NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "onsite_period_staff_period_id_weekday_slot_user_id_pk" PRIMARY KEY("period_id","weekday","slot","user_id")
);
--> statement-breakpoint
CREATE TABLE "onsite_period_titles" (
	"period_id" integer NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "onsite_period_titles_period_id_weekday_slot_pk" PRIMARY KEY("period_id","weekday","slot")
);
--> statement-breakpoint
CREATE TABLE "onsite_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onsite_period_staff" ADD CONSTRAINT "onsite_period_staff_period_id_onsite_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."onsite_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_period_staff" ADD CONSTRAINT "onsite_period_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onsite_period_titles" ADD CONSTRAINT "onsite_period_titles_period_id_onsite_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."onsite_periods"("id") ON DELETE cascade ON UPDATE no action;
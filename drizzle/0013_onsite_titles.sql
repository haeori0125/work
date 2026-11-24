CREATE TABLE "onsite_slot_titles" (
	"term" text NOT NULL,
	"weekday" integer NOT NULL,
	"slot" text NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "onsite_slot_titles_term_weekday_slot_pk" PRIMARY KEY("term","weekday","slot")
);

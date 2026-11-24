CREATE TABLE "note_presence" (
	"note_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"line" integer,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "note_presence_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "shared_edit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "note_presence" ADD CONSTRAINT "note_presence_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_presence" ADD CONSTRAINT "note_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "note_shares" (
	"note_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "note_shares_note_id_user_id_pk" PRIMARY KEY("note_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_shares" ADD CONSTRAINT "note_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_shares_user" ON "note_shares" USING btree ("user_id");
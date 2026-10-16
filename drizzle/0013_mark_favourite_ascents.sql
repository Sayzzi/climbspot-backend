CREATE TABLE "favourite_ascents" (
	"visitor_id" uuid NOT NULL,
	"ascent_id" uuid NOT NULL,
	"marked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "favourite_ascents_visitor_id_ascent_id_pk" PRIMARY KEY("visitor_id","ascent_id")
);
--> statement-breakpoint
ALTER TABLE "favourite_ascents" ADD CONSTRAINT "favourite_ascents_ascent_id_ascents_id_fk" FOREIGN KEY ("ascent_id") REFERENCES "public"."ascents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favourite_ascents_visitor_idx" ON "favourite_ascents" USING btree ("visitor_id","marked_at");
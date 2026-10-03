CREATE TABLE "saved_itineraries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"length" double precision NOT NULL,
	"proposal" jsonb NOT NULL,
	"saved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saved_itineraries_owner_idx" ON "saved_itineraries" USING btree ("owner_id","saved_at");
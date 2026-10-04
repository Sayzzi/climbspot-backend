CREATE TABLE "recorded_runs" (
	"visitor_id" uuid NOT NULL,
	"strava_id" bigint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"distance" double precision NOT NULL,
	"moving_time" double precision NOT NULL,
	"track" jsonb NOT NULL,
	CONSTRAINT "recorded_runs_visitor_id_strava_id_pk" PRIMARY KEY("visitor_id","strava_id")
);
--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "last_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "strava_connections" ADD COLUMN "lost_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "recorded_runs_visitor_idx" ON "recorded_runs" USING btree ("visitor_id","started_at");
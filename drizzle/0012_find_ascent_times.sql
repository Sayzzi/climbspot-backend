CREATE TABLE "ascent_times" (
	"visitor_id" uuid NOT NULL,
	"ascent_id" uuid NOT NULL,
	"strava_id" bigint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"seconds" integer NOT NULL,
	CONSTRAINT "ascent_times_visitor_id_ascent_id_strava_id_started_at_pk" PRIMARY KEY("visitor_id","ascent_id","strava_id","started_at")
);
--> statement-breakpoint
ALTER TABLE "recorded_runs" ADD COLUMN "south" double precision;--> statement-breakpoint
ALTER TABLE "recorded_runs" ADD COLUMN "west" double precision;--> statement-breakpoint
ALTER TABLE "recorded_runs" ADD COLUMN "north" double precision;--> statement-breakpoint
ALTER TABLE "recorded_runs" ADD COLUMN "east" double precision;
CREATE TYPE "public"."ascent_category" AS ENUM('uncategorized', 'cat4', 'cat3', 'cat2', 'cat1', 'hc');--> statement-breakpoint
CREATE TYPE "public"."ascent_surface" AS ENUM('paved', 'gravel', 'trail');--> statement-breakpoint
CREATE TABLE "ascents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"surface" "ascent_surface" NOT NULL,
	"path" geography(LineString, 4326) NOT NULL,
	"elevations" double precision[] NOT NULL,
	"start" geography(Point, 4326) NOT NULL,
	"top" geography(Point, 4326) NOT NULL,
	"length" double precision NOT NULL,
	"elevation_gain" double precision NOT NULL,
	"average_gradient" double precision NOT NULL,
	"maximum_gradient" double precision NOT NULL,
	"difficulty_score" double precision NOT NULL,
	"category" "ascent_category" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);

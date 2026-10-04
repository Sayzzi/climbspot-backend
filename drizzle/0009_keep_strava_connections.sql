CREATE TABLE "strava_connections" (
	"visitor_id" uuid PRIMARY KEY NOT NULL,
	"athlete_id" bigint NOT NULL,
	"athlete_name" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone NOT NULL
);

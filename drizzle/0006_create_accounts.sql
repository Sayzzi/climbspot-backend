CREATE TABLE "accounts" (
	"visitor_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"flat_pace" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

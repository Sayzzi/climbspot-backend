-- Supabase installs extensions in a dedicated `extensions` schema; mirror it everywhere.
CREATE SCHEMA IF NOT EXISTS extensions;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

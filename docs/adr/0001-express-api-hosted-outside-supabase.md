# Express API hosted outside Supabase

Supabase cannot run a long-lived Node.js process: it offers Postgres/PostGIS, Auth, Storage and Deno Edge Functions only. We keep a dedicated Express API, deployed as a regular Node.js service on a container host (Render, Railway or Fly.io), and use Supabase solely as the managed PostGIS database and the identity provider. The API connects to Postgres directly and verifies Supabase-issued JWTs; it never goes through PostgREST or `supabase-js`, so the database and auth provider remain swappable.

## Considered Options

- **Express as a Vercel serverless function**: rejected because of cold starts and connection churn against Postgres on every invocation.
- **No backend, frontend talks to Supabase directly (PostgREST + RLS + Edge Functions)**: rejected because domain rules (elevation resampling, difficulty computation) would end up split between SQL policies and Deno functions, with a hard lock-in to Supabase.

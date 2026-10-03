# Accounts are Supabase Auth identities, verified by the API

Visitors sign in with Supabase Auth (a magic link by e-mail, or Google), in the browser. The API, which runs outside Supabase (ADR 0001), keeps no sessions: each request carries the Supabase access token, which the API verifies itself against the project's public signing keys, behind an identity-verifier port. Signed-in Visitors are known by their Supabase user id; our tables key their data (accounts, Saved Itineraries, Strava Connections, contributed Ascents) on that id without a foreign key into Supabase's own `auth` schema, so the API's schema and tests stay independent of Supabase internals. Deleting an account goes through Supabase's admin API, behind an account-directory port, with a service-role key held by the API only.

## Considered options

- **Our own accounts in the API** (passwords, sessions, e-mails): more to build and to secure, for no gain over a managed service already in the stack.
- **Supabase row-level security, the browser querying Supabase directly**: would split business rules between the API and database policies, against ADR 0001 and ADR 0002.

## Consequences

- The API needs the project's Supabase URL to fetch the signing keys, and the service-role key for account deletion; neither ever reaches the browser.
- Supabase's built-in e-mail sender is rate-limited and meant for testing; a custom SMTP sender is needed before magic links can serve the public.
- Contributed Ascents keep their Contributor's id, set to nothing when the account is deleted; it is never shown to others.

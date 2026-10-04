# Accounts are Supabase Auth identities, verified by the API

Visitors sign in with Supabase Auth (a magic link by e-mail, or Google), in the browser. The API, which runs outside Supabase (ADR 0001), keeps no sessions: each request carries the Supabase access token, which the API verifies itself against the project's public signing keys, behind an identity-verifier port. Signed-in Visitors are known by their Supabase user id; our tables key their data (accounts, Saved Itineraries, Strava Connections, contributed Ascents) on that id without a foreign key into Supabase's own `auth` schema, so the API's schema and tests stay independent of Supabase internals. Deleting an account goes through Supabase's admin API, behind an account-directory port, with a service-role key held by the API only.

## Considered options

- **Our own accounts in the API** (passwords, sessions, e-mails): more to build and to secure, for no gain over a managed service already in the stack.
- **Supabase row-level security, the browser querying Supabase directly**: would split business rules between the API and database policies, against ADR 0001 and ADR 0002.

## Consequences

- The API needs the project's Supabase URL to fetch the signing keys, and the service-role key for account deletion; neither ever reaches the browser.
- Supabase's built-in e-mail sender is rate-limited and meant for testing; a custom SMTP sender is needed before magic links can serve the public.
- Contributed Ascents keep their Contributor's id, set to nothing when the account is deleted; it is never shown to others.

## Amendment: passwords, second factor and passkeys

Visitors may also sign in with a password or a passkey; every method leads to the same account. A Visitor may add an authenticator app as a second factor (TOTP, up to two apps). Once they have, the API itself refuses their sessions that have not passed it (`aal1`), answering `SECOND_FACTOR_REQUIRED`: a second factor only the browser enforced would not protect against a stolen token. Supabase's tokens do not say whether an account has a second factor, so the API asks Supabase's admin API (with the service-role key the account directory uses), behind a second-factors port shared by every route, and keeps the answer for a minute. Only an authenticator app (TOTP) counts as a second factor. When Supabase cannot be asked and no answer of the last minute is kept, those sessions are refused rather than let through. Without the service-role key (in development), the check is off and the API says so as it starts.

Passwords follow NIST SP 800-63B-4: at least 15 characters, as the second factor is optional; no composition rules; known leaked passwords refused. NIST asks for at least 64 characters to be accepted; Supabase keeps passwords with bcrypt, which reads 72 bytes at most, so passwords are accepted up to 72 bytes: 64 characters and more of plain text, fewer with accents or emoji. Supabase refuses leaked passwords on its Pro plan only: until then, the browser checks them against Pwned Passwords, sending only the first five characters of their SHA-1 hash.

### Considered options

- **A Supabase access-token hook** adding "has a second factor" to tokens: no extra call, but logic and settings living inside Supabase, against the decision above that the API decides and Supabase only identifies.
- **Letting sessions through when Supabase cannot be asked**: available, but a second factor that switches off when a dependency fails is no second factor.
- **Our own recovery codes**: security code of our own to write and keep; a second authenticator app, and a manual removal of the factor on request, serve instead.

# ClimbSpot — Backend

REST API for ClimbSpot: find uphill paths (**Ascents**) near you for running, trail running and cycling, and catalogue new ones.

- Domain vocabulary: [`CONTEXT.md`](./CONTEXT.md)
- Architecture decisions: [`docs/adr/`](./docs/adr/0009-accounts-are-supabase-identities-verified-by-the-api.md)
- Frontend: [climbspot-frontend](https://github.com/Sayzzi/climbspot-frontend)

## Stack

| Concern      | Choice                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Runtime      | Node.js 22 (ESM)                                                                                                    |
| HTTP         | Express 5, helmet, cors                                                                                             |
| Validation   | zod 4                                                                                                               |
| API contract | OpenAPI 3.1 generated from zod schemas, served at `GET /openapi.json`                                               |
| Database     | PostgreSQL + PostGIS on Supabase, accessed with Drizzle ORM + postgres.js                                           |
| Auth         | Supabase Auth (magic link, password, Google, passkey; optional second factor) — the API verifies the JWTs it issues |
| Logging      | pino (pretty in development, JSON otherwise)                                                                        |
| Tests        | Vitest + supertest                                                                                                  |
| Quality      | TypeScript strict, ESLint (typescript-eslint strict + boundaries), Prettier, husky, lint-staged, commitlint         |

## Getting started

Requirements: Node.js ≥ 22.12 (see `.nvmrc`) and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env   # then fill in DATABASE_URL
pnpm dev               # http://localhost:3000/health
pnpm db:migrate        # apply migrations (enables PostGIS on first run)
```

Tests need **Docker** running: the suite starts a PostGIS container once per run (`test/global-setup.ts`) and gives each test file its own freshly migrated database, created from a template (`test/database.ts`).

### Routing for Itineraries

Itineraries are routed by OpenRouteService ([ADR 0008](./docs/adr/0008-itineraries-routed-by-openrouteservice.md)). The hosted API allows about 200 directions a day, a few planning requests; for development, run it locally instead, on the areas ClimbSpot is tried on (Lille–Tournai and Annecy–Chamonix):

```bash
brew install osmium-tool
routing/prepare-map.sh                       # downloads and cuts the map (~1.2 GB of sources)
docker compose -f routing/compose.yml up -d  # first start builds the graphs, see `docker logs -f climbspot-routing`
echo 'ORS_URL=http://localhost:8080/ors' >> .env
```

Requests outside those areas find no way. To cover another area, add it to `routing/prepare-map.sh`, rerun it and restart the container with `REBUILD_GRAPHS=True`.

## Scripts

| Script                                          | Purpose                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| `pnpm dev`                                      | Start the API with hot reload                  |
| `pnpm build` / `pnpm start`                     | Compile to `dist/` and run the compiled output |
| `pnpm test` / `test:watch` / `test:coverage`    | Run the test suite                             |
| `pnpm lint` / `lint:fix`                        | Lint, including architectural boundaries       |
| `pnpm format` / `format:check`                  | Format with Prettier                           |
| `pnpm typecheck`                                | Type-check sources, tests and config files     |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Drizzle migrations and studio                  |

### Accounts

Visitors sign in with Supabase Auth in the browser; the API only verifies their tokens against the project's public keys ([ADR 0009](./docs/adr/0009-accounts-are-supabase-identities-verified-by-the-api.md)). Set `SUPABASE_URL` in `.env`. Deleting an account also deletes its Supabase user, which needs `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API keys); without it, deleting answers 503 and erases nothing. The same key lets the API tell which Visitors have a second factor: their sessions that have not given its code answer 401 `SECOND_FACTOR_REQUIRED`; without the key, that check is off and the API warns as it starts.

Signing in is set up once, by hand, in the Supabase dashboard:

1. **Authentication > URL Configuration**: set the Site URL to the frontend's address and add every frontend origin (e.g. `http://localhost:5173/`) to the Redirect URLs, so that sign-in links and Google bring Visitors back.
2. **Authentication > Sign In / Providers > Email**: keep it enabled (it sends the magic links), with **Confirm email** and **Secure password change** on (changing a password then asks for a code by e-mail when the last sign-in is old), and a **minimum password length of 15** (ADR 0009). Add the frontend's `/new-password` page to the Redirect URLs: password recovery links bring Visitors there. On the Pro plan, also turn on **Prevent use of leaked passwords**; until then, the frontend checks new passwords against Pwned Passwords.
3. **Authentication > Multi-Factor**: turn on **TOTP (App Authenticator)**. A Visitor who lost their authenticator app writes to the team; remove their factor in **Authentication > Users**, on their user, under its MFA factors.
4. **Authentication > Passkeys** (in beta at Supabase): turn on **Enable Passkey authentication**, with a display name (`ClimbSpot`), the **Relying Party ID** as the frontend's bare domain (`localhost` in development, no scheme or port) and its **Relying Party Origins** (e.g. `http://localhost:5173`). Changing the Relying Party ID later makes every passkey unusable. Until passkeys are on, Supabase's public settings say `passkeys_enabled: false` and the sign-in page says passkeys are unavailable.
5. **Google**: in the Google Cloud console, create an OAuth client of type _Web application_ whose authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`; then, in **Authentication > Sign In / Providers > Google**, enable it and paste the client ID and secret.

### Strava

Visitors may connect their Strava account. ClimbSpot needs its own Strava application, created on [strava.com/settings/api](https://www.strava.com/settings/api) with `localhost` as its authorization callback domain; its client id and secret go into `.env` as `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`, with `STRAVA_TOKEN_KEY` (`openssl rand -base64 32`) encrypting the tokens kept for each Visitor. Without them, connecting answers 503 `STRAVA_UNAVAILABLE`. A new Strava application serves one athlete, ten before Strava reviews it.

## Architecture

A modular monolith where every business module follows a hexagonal layout ([ADR 0002](./docs/adr/0002-hexagonal-modules-with-manual-injection.md)):

```
src/
├── modules/
│   └── <module>/
│       ├── domain/          # entities, value objects, repository ports, domain errors — no dependencies
│       ├── application/     # use cases, depending only on domain ports
│       ├── infrastructure/  # adapters implementing the ports (Drizzle, external APIs)
│       ├── http/            # Express routers, zod DTOs, OpenAPI registration
│       └── index.ts         # wires the module and exposes it as an HttpModule
├── shared/
│   ├── config/              # environment validation
│   ├── domain/              # DomainError, Position, Identity, and survey/: how any path is sampled and measured
│   ├── http/                # error handling, OpenAPI document, HttpModule contract, who is signed in
│   └── infrastructure/      # logger, database connection, Supabase token verification and second factors
├── app.ts                   # createApp(deps): pure HTTP application, used by tests
└── server.ts                # composition root: reads env, wires dependencies, listens
```

Dependency rules are enforced by `eslint-plugin-boundaries` (see `eslint.config.js`):

- `domain` depends on nothing but the shared domain, and may not import frameworks, drivers or Node I/O.
- `application` depends on `domain`; `infrastructure` and `http` depend inwards, never on each other.
- A module never reaches into another module's layers.
- Only the composition root (`app.ts`, `server.ts`) imports module entry points.

### Adding a module

1. Create `src/modules/<name>/` with the four layers.
2. Expose a `create<Name>Module(deps): HttpModule` from its `index.ts`.
3. Register it in `src/server.ts`. `app.ts` does not change.

### Errors

Business rule violations extend `DomainError` with a stable `code` (e.g. `ASCENT_NOT_FOUND`) and a `kind` (`invalid` → 422, `not_found` → 404, `conflict` → 409, `unauthorized` → 401, `forbidden` → 403, `too_large` → 413, `unavailable` → 503). The error handler maps the kind to an HTTP status and always answers with the `ApiError` shape:

```json
{ "error": { "code": "ROUTE_NOT_FOUND", "message": "No route matches GET /nope." } }
```

Malformed requests (schema failures, unexpected multipart fields) answer 400 `VALIDATION_FAILED`.

Messages are for developers. Clients translate `code`, never `message`.

### Conventions

- Code, identifiers, commits and documentation are written in English, using the vocabulary from `CONTEXT.md`.
- Measurements are stored in SI units (metres, ratios); conversion happens in the frontend.
- Relative imports use the `.ts` extension; `tsc` rewrites them to `.js` at build time.
- Tests live next to the code they cover (`*.test.ts`).
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`…), enforced by commitlint.

## Deployment

The API is a long-running Node.js process and is deployed on a container host (Render, Railway or Fly.io); Supabase only provides the database and authentication ([ADR 0001](./docs/adr/0001-express-api-hosted-outside-supabase.md)). Configuration comes exclusively from environment variables, documented in `.env.example`. Build with `pnpm build` and start with `pnpm start`.

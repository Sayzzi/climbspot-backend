# The backend owns the API contract

Frontend and backend live in two independent repositories, so request and response types cannot be shared as code. The backend is the single source of truth: every route's input and output is a zod schema, from which an OpenAPI document is generated and served at `/openapi.json`. The frontend generates its TypeScript types from that document (`openapi-typescript`) and calls the API through `openapi-fetch`. Types are never written by hand on the frontend; a contract change shows up as a type error after regeneration.

# Integration tests

These tests run against a REAL PostgreSQL database (not mocked) — they exercise the
service layer directly, which is what every API route handler thinly wraps, so they verify
the actual security-critical behavior (cross-user data isolation, duplicate-email
rejection, wrong-password rejection) that was previously only enforced by code, not
verified by any test.

## Running locally
Requires a running Postgres instance with migrations applied (same as normal dev setup):
```bash
docker compose up -d
npm run db:migrate
npm run test:integration
```

## Running in CI
Already wired into `.github/workflows/ci.yml`, which spins up a real Postgres service
container and runs these tests as part of every push/PR.

## Why service-layer tests instead of HTTP-layer tests
Every route handler in this codebase follows the same thin pattern: verify session →
validate with Zod → call a service function → return JSON (see `docs/API.md`). The
security-critical logic — ownership checks, password verification, uniqueness
constraints — lives entirely in the service functions, not in the HTTP glue around them.
Testing at the service layer directly verifies the same security properties with less
test infrastructure (no need to spin up a full Next.js server or manage HTTP session
cookies in the test itself) while still exercising the real database.

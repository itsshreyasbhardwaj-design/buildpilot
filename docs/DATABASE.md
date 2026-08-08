# Database

## Local / demo (default)

SQLite via `@prisma/adapter-better-sqlite3` — `prisma/dev.db`, created
automatically by `pnpm db:migrate`. Zero setup: no Docker, no cloud account,
no signup. This is the intended path for `git clone && pnpm install && pnpm
db:migrate && pnpm db:seed && pnpm dev`.

The Prisma client is instantiated with the adapter in `src/lib/db.ts` — this
is the *only* place the database connection is constructed. Every other file
imports `db` from there.

## Switching to PostgreSQL / Supabase

1. Change `prisma/schema.prisma`'s `datasource` block: `provider =
   "postgresql"`.
2. Install `@prisma/adapter-pg` (or the Supabase-recommended equivalent) and
   swap it in for `PrismaBetterSqlite3` in `src/lib/db.ts`.
3. Set `DATABASE_URL` to your Postgres connection string.
4. Re-run `prisma migrate dev` — SQLite and Postgres have minor type
   differences (e.g. `Json` columns), but this schema was written to avoid
   provider-specific features (no native enums, no array columns) precisely
   so this migration is mechanical.

## Why SQLite types look the way they do

- IDs are `String @default(cuid())`, not autoincrement ints — works
  identically on both providers.
- Enums are `String` with a comment listing valid values, not Prisma
  `enum` — SQLite has no native enum type, and keeping one representation
  avoids a schema fork.
- Arrays (`changedFiles`, `relevantFiles`, `evidence`) are JSON-stringified
  `String` columns, not Postgres array columns — same reasoning.

## Seeding

`pnpm db:seed` runs `prisma/seed.ts`, which generates three synthetic demo
repositories with ~30 days of realistic build history — see
`docs/DEMO_MODE.md`. Seeding is also triggered automatically the first time
someone uses the "Continue with demo workspace" login flow
(`ensureDemoData()` in `src/lib/demo/seed-data.ts`), so a fresh clone never
requires a manual seed step.

## Resetting

`pnpm db:reset` runs `prisma migrate reset --force`. **If a dev server is
already running against the same SQLite file, restart it after a reset** —
a long-lived process's file handle can keep pointing at the pre-reset file
contents depending on how the OS handles the delete+recreate, which will
surface as `PrismaClientKnownRequestError: P2025` (record not found) even
though the data looks correct from a fresh `tsx` script. This is a genuine
gotcha encountered while building this project, not a hypothetical.

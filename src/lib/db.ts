import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Local/demo runs on a SQLite file via the better-sqlite3 driver adapter — zero
// external services required. Swapping to Postgres/Supabase in production means
// swapping this adapter (e.g. `@prisma/adapter-pg`) and the schema's
// `datasource.provider`; nothing above the data-access layer changes because
// callers only ever import `db` from this module. See docs/DATABASE.md.
function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

declare global {
  var __buildpilotPrisma: PrismaClient | undefined;
}

// Next.js dev reloads modules on every request; caching on `global` avoids
// exhausting the sqlite file's connection pool across hot reloads.
export const db = globalThis.__buildpilotPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__buildpilotPrisma = db;
}

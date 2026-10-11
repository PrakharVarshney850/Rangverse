import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const bootstrapFile = path.join(here, "auth-bootstrap.sql");

export type ActingRole = "anon" | "authenticated" | "service_role";

export interface Identity {
  id: string;
  role?: ActingRole;
  email?: string;
}

const ALLOWED_ROLES: readonly ActingRole[] = ["anon", "authenticated", "service_role"];

/**
 * A real PostgreSQL instance (PGlite = Postgres compiled to WebAssembly) with
 * the Rangverse migrations applied, plus the Supabase auth shim.
 *
 * Tests exercise the genuine policies, triggers, constraints and indexes — not
 * a simulation of them.
 */
export class TestDatabase {
  private constructor(private readonly pg: PGlite) {}

  static async create(): Promise<TestDatabase> {
    const pg = new PGlite();
    await pg.waitReady;

    const bootstrap = await readFile(bootstrapFile, "utf8");
    await pg.exec(bootstrap);

    for (const file of await listMigrations()) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      try {
        await pg.exec(sql);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }

    return new TestDatabase(pg);
  }

  /** Run SQL as the database owner, bypassing RLS. Used for fixtures only. */
  async asOwner<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await this.resetContext();
    const result = await this.pg.query<T>(sql, params);
    return result.rows;
  }

  async execAsOwner(sql: string): Promise<void> {
    await this.resetContext();
    await this.pg.exec(sql);
  }

  /**
   * Run a query exactly as Supabase would for the given identity: the request
   * claims are set and the session switches to the matching database role, so
   * row level security is enforced.
   */
  async asUser<T = Record<string, unknown>>(
    identity: Identity | null,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await this.enterContext(identity);
    try {
      const result = await this.pg.query<T>(sql, params);
      return result.rows;
    } finally {
      await this.resetContext();
    }
  }

  /**
   * Convenience wrapper asserting that an operation is rejected. Returns the
   * PostgreSQL error message so tests can assert on the reason, not just that
   * "something failed".
   */
  async expectDenied(
    identity: Identity | null,
    sql: string,
    params: unknown[] = [],
  ): Promise<string> {
    try {
      await this.asUser(identity, sql, params);
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(`Expected the operation to be denied, but it succeeded:\n${sql}`);
  }

  async close(): Promise<void> {
    await this.pg.close();
  }

  private async enterContext(identity: Identity | null): Promise<void> {
    await this.resetContext();

    if (!identity) {
      await this.pg.query("select set_config('request.jwt.claims', $1, false)", [
        JSON.stringify({ role: "anon" }),
      ]);
      await this.pg.exec("set role anon;");
      return;
    }

    const role: ActingRole = identity.role ?? "authenticated";
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`Unsupported acting role: ${role}`);
    }

    const claims: Record<string, unknown> = { sub: identity.id, role };
    if (identity.email) {
      claims.email = identity.email;
    }

    await this.pg.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify(claims),
    ]);
    await this.pg.exec(`set role ${role};`);
  }

  private async resetContext(): Promise<void> {
    await this.pg.exec("reset role;");
    await this.pg.query("select set_config('request.jwt.claims', '', false)");
  }
}

async function listMigrations(): Promise<string[]> {
  const entries = await readdir(migrationsDir);
  return entries.filter((name) => name.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
}

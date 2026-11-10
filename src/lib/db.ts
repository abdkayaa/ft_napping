// One tiny query interface over two drivers:
//  - DATABASE_URL=postgres://...  -> real Postgres (Neon/Supabase/etc., use this on Vercel)
//  - DATABASE_URL unset           -> PGlite stored in ./.data/pglite (local dev only)
//  - DATABASE_URL=memory://       -> PGlite in memory (tests)
import { SCHEMA_SQL, seed } from "./schema";

export type Row = Record<string, unknown>;
export interface Q {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}
export interface Db extends Q {
  /** multi-statement SQL, no params */
  exec(text: string): Promise<void>;
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>;
}

async function pglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite creates only the last path segment, so make the parents first
  if (dataDir) (await import("node:fs")).mkdirSync(dataDir, { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Q => ({
    query: async <T,>(t: string, p?: unknown[]) => (await c.query(t, p)).rows as T[],
  });
  return { ...wrap(pg), exec: async (t) => void (await pg.exec(t)), tx: (fn) => pg.transaction((t) => fn(wrap(t))) };
}

async function postgres(url: string): Promise<Db> {
  const { default: pgjs } = await import("postgres");
  const sql = pgjs(url, { max: 5, prepare: false, onnotice: () => {} });
  type U = { unsafe: (t: string, p?: never[]) => Promise<unknown[]> };
  const wrap = (c: U): Q => ({
    query: async <T,>(t: string, p?: unknown[]) => [...(await c.unsafe(t, (p ?? []) as never[]))] as T[],
  });
  return {
    ...wrap(sql as unknown as U),
    exec: async (t) => void (await sql.unsafe(t)),
    tx: (fn) => sql.begin((t) => fn(wrap(t as unknown as U))) as never,
  };
}

const g = globalThis as unknown as { __uykuDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__uykuDb) {
    g.__uykuDb = (async () => {
      const url = process.env.DATABASE_URL;
      const d = !url ? await pglite("./.data/pglite") : url === "memory://" ? await pglite() : await postgres(url);
      await d.exec(SCHEMA_SQL);
      await seed(d);
      return d;
    })();
    g.__uykuDb.catch(() => (g.__uykuDb = undefined));
  }
  return g.__uykuDb;
}

/** tests only */
export function resetDbForTests() {
  g.__uykuDb = undefined;
}

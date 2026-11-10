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

// Vercel freezes an idle instance and thaws it for the next request. Sockets that were open
// before the freeze are dead by then, but nobody told the client: a query sent on one waits
// until the function is killed (300 s). So: close idle sockets fast, throw away a pool that
// sat unused, and never let one query wait longer than a few seconds.
const STALE_MS = 15_000;
const RETRY = new Set(["CONNECTION_CLOSED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "QUERY_TIMEOUT", "QUEUE_TIMEOUT", "ECONNRESET", "EPIPE", "ETIMEDOUT"]);

async function postgres(url: string): Promise<Db> {
  const { default: pgjs } = await import("postgres");
  const open = () =>
    pgjs(url, {
      max: 5,
      prepare: false,
      onnotice: () => {},
      idle_timeout: 10,
      max_lifetime: 300,
      connect_timeout: 8,
      queue_timeout: 8,
      query_timeout: 10,
    });
  type U = { unsafe: (t: string, p?: never[]) => Promise<unknown[]> };
  let sql = open();
  let last = Date.now();
  const fresh = (force = false) => {
    if (force || Date.now() - last > STALE_MS) {
      void sql.end({ timeout: 0 }).catch(() => {});
      sql = open();
    }
    last = Date.now();
    return sql;
  };
  const run = async <T,>(c: U, t: string, p?: unknown[]) => [...(await c.unsafe(t, (p ?? []) as never[]))] as T[];
  return {
    query: async <T,>(t: string, p?: unknown[]) => {
      try {
        return await run<T>(fresh() as unknown as U, t, p);
      } catch (e) {
        // a read is safe to repeat on a new connection; a write is not, so it surfaces
        if (!RETRY.has((e as { code?: string }).code ?? "") || !/^\s*select\b/i.test(t)) throw e;
        return run<T>(fresh(true) as unknown as U, t, p);
      } finally {
        last = Date.now();
      }
    },
    exec: async (t) => void (await fresh().unsafe(t)),
    tx: async (fn) => {
      let started = false;
      const go = (s: typeof sql) =>
        s.begin((t) => {
          started = true;
          return fn({ query: (q, p) => run(t as unknown as U, q, p) });
        }) as never;
      try {
        return await go(fresh());
      } catch (e) {
        // only when the connection died before the first statement: nothing ran, so repeating is safe
        if (started || !RETRY.has((e as { code?: string }).code ?? "")) throw e;
        return await go(fresh(true));
      } finally {
        last = Date.now();
      }
    },
  };
}

/** bump when SCHEMA_SQL changes */
const SCHEMA_VERSION = 1;

const g = globalThis as unknown as { __uykuDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__uykuDb) {
    g.__uykuDb = (async () => {
      const url = process.env.DATABASE_URL;
      const d = !url ? await pglite("./.data/pglite") : url === "memory://" ? await pglite() : await postgres(url);
      // The DDL takes exclusive table locks, so run it once per schema version, not on every cold start.
      const done = await d
        .query<{ value: number }>("select value from settings where key='schema_version'")
        .then((r) => r[0]?.value === SCHEMA_VERSION, () => false);
      if (!done) {
        await d.exec(SCHEMA_SQL);
        await seed(d);
        await d.query(
          "insert into settings(key, value) values ('schema_version', $1::jsonb) on conflict (key) do update set value = excluded.value",
          [JSON.stringify(SCHEMA_VERSION)],
        );
      }
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

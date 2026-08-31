import { Pool } from "pg";

// One pool per serverless instance, reused across hot invocations.
const g = globalThis as typeof globalThis & { _baithakPool?: Pool };

function pool() {
  if (!g._baithakPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
    g._baithakPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Supabase's pooler presents its own CA
      max: 1,
    });
  }
  return g._baithakPool;
}

/** Parameterized query. $1/$2 placeholders only — the transaction pooler rejects named prepared statements. */
export async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(sql, params);
  return r.rows as T[];
}

import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { env } from '../config/env.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;
let isEmbedded = false;

export async function initDb(): Promise<void> {
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    const fallbackPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    if (fs.existsSync(fallbackPath)) {
      schemaPath = fallbackPath;
    }
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Try PostgreSQL connection if DATABASE_URL is provided and USE_EMBEDDED_POSTGRES is not explicitly 'true'
  if (env.DATABASE_URL && env.USE_EMBEDDED_POSTGRES !== 'true') {
    try {
      console.log('[DB] Connecting to PostgreSQL at', env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
      const pool = new Pool({
        connectionString: env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const testRes = await pool.query('SELECT NOW()');
      pgPool = pool;
      isEmbedded = false;
      console.log('[DB] Connected to PostgreSQL successfully at', testRes.rows[0].now);

      // Execute schema
      await pgPool.query(schemaSql);
      console.log('[DB] PostgreSQL schema initialized successfully.');
      return;
    } catch (err) {
      console.warn('[DB] PostgreSQL connection failed. Falling back to embedded PostgreSQL (PGlite)...', (err as Error).message);
    }
  }

  // Fallback or explicit embedded mode
  console.log('[DB] Initializing Embedded PostgreSQL (PGlite)...');
  const dataDir = path.resolve(process.cwd(), env.DATA_DIR, 'pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  isEmbedded = true;
  try {
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    await pgliteInstance.exec(schemaSql);
  } catch (initErr) {
    console.warn('[DB] PGlite failed to load from existing directory. Self-healing data directory...');
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.mkdirSync(dataDir, { recursive: true });
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    await pgliteInstance.exec(schemaSql);
  }
  console.log('[DB] Embedded PostgreSQL initialized successfully in', dataDir);

  // Auto-seed if database has no users
  try {
    const userCount = await query('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(userCount.rows[0]?.cnt || '0', 10) === 0) {
      console.log('[DB] Database is empty. Auto-seeding initial demo data...');
      const { seed } = await import('./seed.js');
      await seed(true);
    }
  } catch (seedErr: any) {
    console.warn('[DB] Auto-seed check notice:', seedErr.message);
  }
}

export function getDbMode(): 'postgres' | 'embedded' {
  return isEmbedded ? 'embedded' : 'postgres';
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
  if (pgPool) {
    const res = await pgPool.query(sql, params);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  } else if (pgliteInstance) {
    const res = await pgliteInstance.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rows.length };
  } else {
    throw new Error('Database not initialized. Call initDb() first.');
  }
}

export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txClient: DbClient = {
        query: async (sql, params) => {
          const res = await client.query(sql, params);
          return { rows: res.rows, rowCount: res.rowCount ?? 0 };
        },
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } else if (pgliteInstance) {
    return await pgliteInstance.transaction(async (tx) => {
      const txClient: DbClient = {
        query: async (sql, params) => {
          const res = await tx.query(sql, params);
          return { rows: res.rows as any, rowCount: res.rows.length };
        },
      };
      return await callback(txClient);
    });
  } else {
    throw new Error('Database not initialized. Call initDb() first.');
  }
}

export async function closeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}

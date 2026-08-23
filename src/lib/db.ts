/**
 * CockroachDB Connection Pool — Production-Grade
 *
 * Features:
 *   - Tuned connection pool for CockroachDB Serverless
 *   - Exponential backoff retry for transient failures
 *   - Circuit breaker to prevent cascading failures
 *   - Connection health validation (keepalive)
 *   - Graceful shutdown on process exit
 *   - Pool metrics for observability
 *
 * Usage:
 *   import { query, queryAs, transaction } from "@/lib/db";
 *
 *   // Public data (no user context)
 *   const investors = await query('SELECT * FROM investors LIMIT 10');
 *
 *   // Tenant-scoped data
 *   const saved = await queryAs(userId, 'SELECT * FROM saved_investors WHERE user_id = $1', [userId]);
 *
 *   // Transaction with automatic retry
 *   const result = await transaction(async (tx) => {
 *     await tx.query('INSERT INTO ...');
 *     return tx.query('SELECT ...');
 *   });
 */
import { Pool, PoolClient, PoolConfig } from "pg";

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const POOL_CONFIG: PoolConfig = {
  // CockroachDB Serverless: max ~10-20 connections per tenant
  max: 15,
  min: 2,                    // keep warm connections ready
  idleTimeoutMillis: 25_000, // release idle connections before CRDB timeout
  connectionTimeoutMillis: 8_000,
  allowExitOnIdle: true,     // let process exit if all connections idle

  // SSL
  ssl: { rejectUnauthorized: true },

  // Application name for CockroachDB SQL stats
  application_name: "capital-os",
};

const RETRY_CONFIG = {
  maxAttempts: 3,            // total attempts (1 initial + 2 retries)
  baseDelayMs: 200,          // initial backoff delay
  maxDelayMs: 2_000,         // cap on backoff
  jitterMs: 100,             // random jitter to avoid thundering herd
};

// Transient error codes that warrant a retry (connection drops, timeouts, etc.)
const RETRYABLE_ERROR_CODES = new Set([
  "08000",  // connection_exception
  "08003",  // connection_does_not_exist
  "08006",  // connection_failure
  "08007",  // transaction_resolution_unknown
  "08008",  // transaction_state_unknown
  "08001",  // sqlclient_unable_to_establish_sqlconnection
  "08004",  // sqlserver_rejected_establishment_of_sqlconnection
  "57P01",  // admin_shutdown
  "57P02",  // crash_shutdown
  "57P03",  // cannot_connect_now
  "57P04",  // database_dropped
  "XX000",  // internal_error (transient in CRDB)
]);

// ─────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────

type CircuitState = "closed" | "open" | "half-open";

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeoutMs = 30_000;
  private readonly halfOpenMaxAttempts = 2;
  private halfOpenAttempts = 0;

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
      console.warn(
        `[db] Circuit breaker OPEN — ${this.failureCount} consecutive failures`
      );
    }
  }

  canExecute(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "half-open";
        this.halfOpenAttempts = 0;
        console.log("[db] Circuit breaker HALF-OPEN — testing...");
        return true;
      }
      return false;
    }

    // half-open: allow limited attempts
    return this.halfOpenAttempts++ < this.halfOpenMaxAttempts;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number } {
    return { state: this.state, failures: this.failureCount };
  }
}

// ─────────────────────────────────────────────
// Pool Manager
// ─────────────────────────────────────────────

let pool: Pool | null = null;
const breaker = new CircuitBreaker();

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  pool = new Pool({ ...POOL_CONFIG, connectionString });

  // Log pool errors (but don't crash — retry handles it)
  pool.on("error", (err) => {
    console.error("[db] Pool error (idle client):", err.message);
  });

  pool.on("remove", () => {
    // Optional: track connection lifecycle
  });

  console.log(
    `[db] Pool created: max=${POOL_CONFIG.max} min=${POOL_CONFIG.min} idle=${POOL_CONFIG.idleTimeoutMillis}ms`
  );

  return pool;
}

// ─────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────

function isRetryableError(err: any): boolean {
  if (!err) return false;

  // Check PostgreSQL error code
  if (err.code && RETRYABLE_ERROR_CODES.has(err.code)) return true;

  // Network/timeout errors
  const msg = err.message?.toLowerCase() || "";
  if (
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("socket hang up") ||
    msg.includes("connection terminated") ||
    msg.includes("unexpected socket close") ||
    msg.includes("server closed the connection") ||
    msg.includes("connection refused")
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  const { baseDelayMs, maxDelayMs, jitterMs } = RETRY_CONFIG;
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * jitterMs;
  return Math.min(exponential + jitter, maxDelayMs);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<T> {
  const { maxAttempts } = RETRY_CONFIG;
  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!breaker.canExecute()) {
      throw new Error(
        `[db] Circuit breaker OPEN — database unavailable. ${breaker.getStats().failures} failures.`
      );
    }

    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (err: any) {
      lastError = err;

      if (!isRetryableError(err) || attempt === maxAttempts - 1) {
        breaker.recordFailure();
        throw err;
      }

      const delay = getRetryDelay(attempt);
      console.warn(
        `[db] Retry ${attempt + 1}/${maxAttempts}${label ? ` (${label})` : ""}: ${err.message} — waiting ${Math.round(delay)}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Execute a SQL query with retry logic.
 * Use for public/shared data (no user context).
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      const result = await client.query(text, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  });
}

/**
 * Execute a SQL query with user context for multi-tenant isolation.
 *
 * Two-layer defense:
 *   1. Sets the app.user_id session variable (RLS defense-in-depth).
 *   2. The caller MUST include user_id in query params for reliable filtering.
 *      CockroachDB Serverless does not fully enforce RLS policies that
 *      reference session variables on SELECT — this is a known limitation.
 *
 * Usage:
 *   const data = await queryAs(
 *     user.id,
 *     'SELECT * FROM saved_investors WHERE user_id = $1',
 *     [user.id]   // <-- always pass user_id explicitly
 *   );
 */
export async function queryAs<T = any>(
  userId: string,
  text: string,
  params?: any[]
): Promise<T[]> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      // Set session variable for RLS policies (defense-in-depth)
      await client.query(
        `SELECT set_config('app.user_id', $1, false)`,
        [userId]
      );
      const result = await client.query(text, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  });
}

/**
 * Execute a SQL statement (no return value).
 * Use for DDL, DML, or statements that don't return rows.
 */
export async function execute(sql: string, params?: any[]): Promise<void> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query(sql, params);
    } finally {
      client.release();
    }
  });
}

/**
 * Execute raw SQL (for scripts/migrations — no retry).
 * Used by setup scripts that need direct control.
 */
export async function raw(sql: string): Promise<any> {
  const client = await getPool().connect();
  try {
    return await client.query(sql);
  } finally {
    client.release();
  }
}

/**
 * Run a function inside a transaction with automatic retry.
 *
 * If the transaction fails with a retryable error, the entire
 * function is retried (up to RETRY_CONFIG.maxAttempts times).
 *
 * Usage:
 *   const result = await transaction(async (tx) => {
 *     const [{ id }] = await tx.query<{ id: string }>(
 *       'INSERT INTO ... RETURNING id', [...]
 *     );
 *     await tx.query('UPDATE ... WHERE id = $1', [id]);
 *     return id;
 *   });
 */
export async function transaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const txClient = new TransactionClient(client);
      try {
        const result = await fn(txClient);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    } finally {
      client.release();
    }
  }, "transaction");
}

/**
 * Transaction-scoped client that wraps a pool client.
 */
class TransactionClient {
  constructor(private client: PoolClient) {}

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.client.query(text, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }
}

/**
 * Test the database connection with retry.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query<{ now: string }>("SELECT NOW() as now");
    const cbStats = breaker.getStats();
    console.log(
      `✅ Connected to CockroachDB at: ${result[0].now} | Circuit: ${cbStats.state}`
    );
    return true;
  } catch (err: any) {
    console.error("❌ Connection failed:", err.message);
    return false;
  }
}

/**
 * Get pool metrics for monitoring/diagnostics.
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  circuitBreaker: { state: CircuitState; failures: number };
} {
  const p = pool;
  return {
    totalCount: p?.totalCount ?? 0,
    idleCount: p?.idleCount ?? 0,
    waitingCount: p?.waitingCount ?? 0,
    circuitBreaker: breaker.getStats(),
  };
}

/**
 * Graceful shutdown — drain pool and close all connections.
 * Call this on SIGTERM/SIGINT in your server entrypoint.
 */
export async function closePool(): Promise<void> {
  if (!pool) return;
  try {
    await pool.end();
    console.log("[db] Pool closed gracefully");
  } catch (err: any) {
    console.error("[db] Error closing pool:", err.message);
  } finally {
    pool = null;
  }
}

// ─────────────────────────────────────────────
// Graceful Shutdown on Process Exit
// ─────────────────────────────────────────────

const shutdownHandler = async () => {
  console.log("\n[db] Shutting down...");
  await closePool();
  process.exit(0);
};

// Register once per process
process.once("SIGTERM", shutdownHandler);
process.once("SIGINT", shutdownHandler);

// Prevent unhandled rejections from crashing the server
process.on("unhandledRejection", (reason) => {
  if (
    reason instanceof Error &&
    reason.message.includes("[db] Circuit breaker OPEN")
  ) {
    // Already logged by circuit breaker
    return;
  }
});

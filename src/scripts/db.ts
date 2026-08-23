// Shared database helper for scripts
// Usage: import { query, closePool } from "./db";

import { config } from "dotenv";
import { Pool } from "pg";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 10,
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

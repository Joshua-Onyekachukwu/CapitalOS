import { query, closePool } from "./db";

async function main() {
  const rows = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM investors");
  console.log("Current investor count:", rows[0]?.count || "0");
  await closePool();
}

main();

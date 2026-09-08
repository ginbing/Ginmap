import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sql = await readFile(resolve(root, "migrations/0001_initial.sql"), "utf8");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log("Database migration complete");
} finally {
  await client.end();
}

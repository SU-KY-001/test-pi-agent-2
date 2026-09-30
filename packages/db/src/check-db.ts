import fs from "node:fs";
import path from "node:path";

const pgdataPath = path.resolve(import.meta.dir, "../data/pgdata");
const force = process.argv.includes("--force");

if (force && fs.existsSync(pgdataPath)) {
  console.log(`[check-db] Cleaning database directory at ${pgdataPath}...`);
  fs.rmSync(pgdataPath, { recursive: true, force: true });
  console.log("[check-db] Cleaned successfully.");
}

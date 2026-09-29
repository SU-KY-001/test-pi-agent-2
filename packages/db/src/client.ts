import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const fallbackDir = path.resolve(import.meta.dir, "../data/pgdata");
const dbPath = process.env.PGLITE_DATA_DIR
  ? (path.isAbsolute(process.env.PGLITE_DATA_DIR)
      ? process.env.PGLITE_DATA_DIR
      : path.resolve(repoRoot, process.env.PGLITE_DATA_DIR))
  : fallbackDir;
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

export const pglite = new PGlite(dbPath);

export async function closePglite(): Promise<void> {
  if (pglite) {
    await pglite.close();
  }
}

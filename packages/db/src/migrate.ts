import { migrate } from "drizzle-orm/pglite/migrator";
import { db } from "./drizzle";
import path from "node:path";

export async function runMigrations(migrationsFolder?: string): Promise<void> {
  const folder = migrationsFolder || path.resolve(import.meta.dir, "../drizzle");
  await migrate(db, { migrationsFolder: folder });
}

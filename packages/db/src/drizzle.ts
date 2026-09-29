import { drizzle } from "drizzle-orm/pglite";
import { pglite } from "./client";
import * as schema from "./schema";

export const db = drizzle({
  client: pglite,
  schema,
});

export type DB = typeof db;

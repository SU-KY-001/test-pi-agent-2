import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data/pgdata",
  },
});

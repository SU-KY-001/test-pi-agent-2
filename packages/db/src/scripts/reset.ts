import fs from "node:fs";
import path from "node:path";

/**
 * Reset sạch PGlite cho demo Flow 2: xoá thư mục pgdata, lần boot sau sẽ
 * tạo DB mới và chạy lại toàn bộ migration.
 */
const pgdataPath = path.resolve(import.meta.dir, "../../data/pgdata");

if (fs.existsSync(pgdataPath)) {
  fs.rmSync(pgdataPath, { recursive: true, force: true });
  console.log(`[db:reset] Removed ${pgdataPath}`);
} else {
  console.log(`[db:reset] Nothing to remove at ${pgdataPath}`);
}
console.log("[db:reset] Done. Run `bun run dev` to recreate and migrate.");

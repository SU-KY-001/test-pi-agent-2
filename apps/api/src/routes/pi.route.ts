import { Hono } from "hono";
import { piService } from "../pi/pi.service";
import { log } from "../config/logger";
import { PiTestResponseSchema } from "@repo/contracts";

export const piRoute = new Hono();

piRoute.post("/test", async (c) => {
  try {
    if (!piService.isReady) {
      return c.json(
        {
          ok: false,
          error: "PiService is not configured (missing OPENCODE_API_KEY or model unavailable)",
          provider: piService.model?.id ? "opencode-go" : "unconfigured",
          model: piService.model?.id ?? "none",
        },
        503
      );
    }

    const result = await piService.testSmoke();
    const parsed = PiTestResponseSchema.safeParse(result);
    if (!parsed.success) {
      return c.json({ error: "Invalid response from PiService", details: parsed.error.format() }, 500);
    }

    return c.json(parsed.data);
  } catch (err) {
    log.error({ err }, "Pi smoke test error");
    return c.json({ error: "Pi smoke test execution failed", details: String(err) }, 500);
  }
});

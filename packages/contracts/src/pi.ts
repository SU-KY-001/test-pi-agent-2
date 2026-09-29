import { z } from "zod";

export const PiTestResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.string(),
  model: z.string(),
  response: z.string(),
});

export type PiTestResponse = z.infer<typeof PiTestResponseSchema>;

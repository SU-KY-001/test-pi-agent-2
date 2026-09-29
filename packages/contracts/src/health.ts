import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  services: z.object({
    api: z.boolean(),
    database: z.boolean(),
    queue: z.boolean(),
    pi: z.boolean(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

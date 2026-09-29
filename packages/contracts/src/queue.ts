import { z } from "zod";

export const QueueTestResponseSchema = z.object({
  jobId: z.string(),
});

export type QueueTestResponse = z.infer<typeof QueueTestResponseSchema>;

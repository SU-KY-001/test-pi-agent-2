import { z } from "zod";

export const AdvertisementSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(50).max(1000),
  callToAction: z.string().min(1),
});

export type Advertisement = z.infer<typeof AdvertisementSchema>;

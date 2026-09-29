import { z } from "zod";

export const ProductDataSchema = z.object({
  productName: z.string().min(1),
  capacityMl: z.number().positive().nullable(),
  features: z.array(z.string()),
  coldHours: z.number().positive().nullable(),
  hotHours: z.number().positive().nullable(),
  material: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  audiences: z.array(z.string()),
});

export type ProductData = z.infer<typeof ProductDataSchema>;

import { z } from "zod"

// Conserva gli spazi: gli offset delle menzioni si riferiscono al testo originale.
export const notaInternaInput = z.object({
  contenuto: z.string().max(50_000).refine((value) => value.trim().length > 0, "Nota vuota"),
  menzioni: z.array(z.object({
    userId: z.string().uuid(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }).refine((value) => value.end > value.start)).max(100).optional(),
})

import { z } from 'zod'

export const loginSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: z.string().min(1, 'Signature is required'),
})

export type LoginSchema = z.infer<typeof loginSchema>

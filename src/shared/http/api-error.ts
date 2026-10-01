import { z } from 'zod';

export const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'ROUTE_NOT_FOUND' }),
      message: z.string(),
      details: z.array(z.unknown()).optional(),
    }),
  })
  .meta({ id: 'ApiError' });

export type ApiError = z.infer<typeof apiErrorSchema>;

export function toApiError(code: string, message: string, details?: unknown[]): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

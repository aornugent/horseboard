import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Validation middleware factory
 * Validates request body against a Zod schema
 */
export function validate(
  schema: z.ZodSchema
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

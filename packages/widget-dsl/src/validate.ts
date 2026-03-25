import { WidgetSpecSchema, type WidgetSpec } from './types.js';
import { ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  spec?: WidgetSpec;
  errors?: string[];
}

export function validateWidgetSpec(raw: unknown): ValidationResult {
  try {
    const spec = WidgetSpecSchema.parse(raw);
    return { valid: true, spec };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        valid: false,
        errors: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: [String(err)] };
  }
}

export function parseRefreshInterval(refresh: string): number {
  const match = /^(\d+)(s|m|h)$/.exec(refresh);
  if (!match) throw new Error(`Invalid refresh interval: ${refresh}`);
  const [, amount, unit] = match;
  const ms = parseInt(amount, 10);
  switch (unit) {
    case 's': return ms * 1000;
    case 'm': return ms * 60 * 1000;
    case 'h': return ms * 60 * 60 * 1000;
    default:  throw new Error(`Unknown unit: ${unit}`);
  }
}

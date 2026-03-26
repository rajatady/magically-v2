import { of } from 'rxjs';
import { z } from 'zod';
import type { ValidationCheck, ValidationContext } from '../types';

// Inline the schema here to keep shared self-contained (no circular dep on runtime types)
const ManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  functions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    run: z.string().optional(),
  })).default([]),
  runtime: z.object({
    base: z.string(),
    system: z.array(z.string()).default([]),
    install: z.string().optional(),
  }).optional(),
  secrets: z.array(z.string()).default([]),
  triggers: z.array(z.object({
    type: z.string(),
    name: z.string(),
    entrypoint: z.string(),
  })).default([]),
}).passthrough();

export const manifestSchema: ValidationCheck = {
  meta: {
    id: 'manifest-schema',
    name: 'Manifest matches required schema',
    severity: 'error',
    phase: 'pre-upload',
    category: 'structure',
  },

  validate(ctx: ValidationContext) {
    if (!ctx.manifest) {
      return of({
        check: this.meta,
        passed: false,
        message: 'No manifest available (did manifest-exists check run first?)',
      });
    }

    const result = ManifestSchema.safeParse(ctx.manifest);

    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');

      return of({
        check: this.meta,
        passed: false,
        message: `Manifest schema invalid: ${issues}`,
      });
    }

    return of({ check: this.meta, passed: true, message: 'Manifest schema valid' });
  },
};

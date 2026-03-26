import { of } from 'rxjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ValidationCheck, ValidationContext } from '../types';

export const manifestExists: ValidationCheck = {
  meta: {
    id: 'manifest-exists',
    name: 'Manifest exists and is valid JSON',
    severity: 'error',
    phase: 'pre-upload',
    category: 'structure',
  },

  validate(ctx: ValidationContext) {
    const path = join(ctx.agentDir, 'manifest.json');

    if (!existsSync(path)) {
      return of({
        check: this.meta,
        passed: false,
        message: 'manifest.json not found',
        details: `Expected at ${path}`,
      });
    }

    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw);
      ctx.manifest = parsed;
      ctx.data.set('manifest.raw', raw);
      return of({ check: this.meta, passed: true, message: 'manifest.json found and valid JSON' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return of({
        check: this.meta,
        passed: false,
        message: `manifest.json is not valid JSON: ${message}`,
      });
    }
  },
};

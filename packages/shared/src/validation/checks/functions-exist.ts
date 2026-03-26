import { of, from, mergeMap, toArray, map } from 'rxjs';
import { existsSync } from 'fs';
import { join } from 'path';
import type { ValidationCheck, ValidationContext, CheckResult } from '../types';

export const functionsExist: ValidationCheck = {
  meta: {
    id: 'functions-exist',
    name: 'All declared functions have corresponding files',
    severity: 'error',
    phase: 'pre-upload',
    category: 'structure',
  },

  validate(ctx: ValidationContext) {
    if (!ctx.manifest) {
      return of({
        check: this.meta,
        passed: false,
        message: 'No manifest available',
      });
    }

    const functions = (ctx.manifest.functions ?? []) as Array<{ name: string; run?: string }>;

    if (functions.length === 0) {
      return of({ check: this.meta, passed: true, message: 'No functions declared' });
    }

    const missing: string[] = [];
    const hasRuntime = !!ctx.manifest.runtime;

    for (const fn of functions) {
      if (hasRuntime && fn.run) {
        // Container agent with explicit run command — the file referenced in run must exist
        // e.g. "run": "python greet.py" → check greet.py
        // e.g. "run": "node functions/growthCycle.js" → check functions/growthCycle.js
        const parts = fn.run.split(' ');
        const script = parts[parts.length - 1]; // last arg is typically the file
        const scriptPath = join(ctx.agentDir, script);
        if (!existsSync(scriptPath)) {
          missing.push(`${fn.name}: ${script}`);
        }
      } else {
        // Lightweight agent — expects functions/{name}.js
        const fnPath = join(ctx.agentDir, 'functions', `${fn.name}.js`);
        if (!existsSync(fnPath)) {
          missing.push(`${fn.name}: functions/${fn.name}.js`);
        }
      }
    }

    if (missing.length > 0) {
      return of({
        check: this.meta,
        passed: false,
        message: `Missing function files: ${missing.join(', ')}`,
      });
    }

    return of({
      check: this.meta,
      passed: true,
      message: `All ${functions.length} function files found`,
    });
  },
};

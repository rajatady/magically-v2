import { of } from 'rxjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ValidationCheck, ValidationContext } from '../types';

/**
 * For container agents with JS function files:
 * Check that the file is self-executing (not just module.exports).
 *
 * Container agents run via `node file.js` — if the file only exports a function
 * without calling it, nothing happens. The function must either:
 * - Be self-executing (reads env vars, does work, prints output)
 * - Or export AND invoke itself (module.exports = fn; fn(...))
 *
 * Pattern: if the file contains `module.exports` or `export default` but no
 * top-level invocation, it's written for in-process execution, not containers.
 */
export const functionsExecutable: ValidationCheck = {
  meta: {
    id: 'functions-executable',
    name: 'Container agent JS functions are self-executing',
    severity: 'warning',
    phase: 'pre-upload',
    category: 'compatibility',
  },

  validate(ctx: ValidationContext) {
    if (!ctx.manifest) {
      return of({ check: this.meta, passed: true, message: 'No manifest' });
    }

    if (!ctx.manifest.runtime) {
      return of({ check: this.meta, passed: true, message: 'Lightweight agent — skip' });
    }

    const functions = (ctx.manifest.functions ?? []) as Array<{ name: string; run?: string }>;
    const issues: string[] = [];

    for (const fn of functions) {
      if (!fn.run) continue;

      const parts = fn.run.split(' ');
      const interpreter = parts[0];
      const script = parts[parts.length - 1];

      // Only inspect JS/TS files
      if (!script.endsWith('.js') && !script.endsWith('.ts')) continue;
      if (interpreter !== 'node' && interpreter !== 'bun') continue;

      const filePath = join(ctx.agentDir, script);
      if (!existsSync(filePath)) continue;

      const source = readFileSync(filePath, 'utf-8');

      // Detect module export pattern without self-invocation
      const exportsFunction = /module\.exports\s*=\s*(async\s+)?function/.test(source)
        || /exports\.default\s*=/.test(source)
        || /export\s+default\s+(async\s+)?function/.test(source);

      if (exportsFunction) {
        // Check if the exported function is also called at the bottom
        // Common self-invoke patterns:
        // - module.exports(...) at the end
        // - const fn = ...; fn();
        // - if (require.main === module) { ... }
        const hasSelfInvoke =
          /require\.main\s*===\s*module/.test(source) ||
          /if\s*\(\s*!module\.parent/.test(source) ||
          /\(\s*\)\s*;?\s*$/.test(source.trim()); // ends with ()

        if (!hasSelfInvoke) {
          issues.push(
            `${fn.name} (${script}): exports a function but doesn't self-execute. ` +
            `Container agents run as \`${fn.run}\` — the exported function will never be called. ` +
            `Add \`if (require.main === module) { ... }\` or make it a standalone script.`,
          );
        }
      }
    }

    if (issues.length > 0) {
      return of({
        check: this.meta,
        passed: false,
        message: issues.join('\n'),
      });
    }

    return of({
      check: this.meta,
      passed: true,
      message: 'All container JS functions are self-executing',
    });
  },
};

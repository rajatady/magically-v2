export { ValidationPipeline } from './pipeline';
export type {
  ValidationCheck,
  ValidationContext,
  ValidationResult,
  CheckResult,
  CheckMeta,
  CheckSeverity,
  CheckPhase,
  CheckCategory,
} from './types';
export type { PipelineOptions } from './pipeline';

export * from './checks';

// ─── Pre-built pipelines ─────────────────────────────────────────────────────

import { ValidationPipeline } from './pipeline';
import { manifestExists } from './checks/manifest-exists';
import { manifestSchema } from './checks/manifest-schema';
import { functionsExist } from './checks/functions-exist';
import { functionsExecutable } from './checks/functions-executable';
import { noHardcodedSecrets } from './checks/no-hardcoded-secrets';

/**
 * Standard publish pipeline with all built-in checks.
 * Order matters — manifest-exists runs first and populates ctx.manifest
 * for subsequent checks.
 */
export function createPublishPipeline(): ValidationPipeline {
  return new ValidationPipeline([
    manifestExists,
    manifestSchema,
    functionsExist,
    functionsExecutable,
    noHardcodedSecrets,
  ]);
}

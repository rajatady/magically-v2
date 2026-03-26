import {
  Observable,
  from,
  of,
  EMPTY,
  concat,
  lastValueFrom,
  catchError,
  concatMap,
  takeWhile,
  scan,
  shareReplay,
  map,
  toArray,
} from 'rxjs';
import type {
  ValidationCheck,
  ValidationContext,
  ValidationResult,
  CheckResult,
  CheckPhase,
} from './types';

export interface PipelineOptions {
  /** Stop executing after the first error-severity failure */
  shortCircuit?: boolean;
}

/**
 * A reactive validation pipeline that composes checks as an RxJS Observable stream.
 *
 * Each check is a pure function: (context) → Observable<CheckResult>.
 * Checks run sequentially (concatMap) to support short-circuiting and context mutation.
 * Results stream in real-time via `stream()`, or await final result via `run()`.
 *
 * Checks are registered once and filtered by phase at execution time.
 * The pipeline is framework-agnostic — works in CLI, NestJS, or any Node process.
 */
export class ValidationPipeline {
  private readonly checks: ValidationCheck[];

  constructor(checks: ValidationCheck[]) {
    this.checks = checks;
  }

  /** Add a check to the pipeline. Returns the pipeline for chaining. */
  add(check: ValidationCheck): this {
    this.checks.push(check);
    return this;
  }

  /**
   * Stream check results as an Observable. Subscribe for real-time progress.
   * Each emission is one CheckResult as it completes.
   */
  stream(
    ctx: ValidationContext,
    phase?: CheckPhase,
    options?: PipelineOptions,
  ): Observable<CheckResult> {
    const filtered = phase
      ? this.checks.filter((c) => c.meta.phase === phase)
      : this.checks;

    if (filtered.length === 0) return EMPTY;

    const shortCircuit = options?.shortCircuit ?? false;
    let hasFatalError = false;

    return from(filtered).pipe(
      // Run checks sequentially
      concatMap((check) => {
        if (shortCircuit && hasFatalError) return EMPTY;

        return check.validate(ctx).pipe(
          // Catch errors thrown by the check itself
          catchError((err: Error) =>
            of({
              check: check.meta,
              passed: false,
              message: err.message,
              details: err.stack,
            } as CheckResult),
          ),
          // Track fatal errors for short-circuit
          map((result) => {
            if (!result.passed && result.check.severity === 'error') {
              hasFatalError = true;
            }
            return result;
          }),
        );
      }),
    );
  }

  /**
   * Run all checks and return the aggregated result.
   * Resolves when all applicable checks have completed.
   */
  async run(
    ctx: ValidationContext,
    phase?: CheckPhase,
    options?: PipelineOptions,
  ): Promise<ValidationResult> {
    const startedAt = Date.now();

    const all = await lastValueFrom(
      this.stream(ctx, phase, options).pipe(toArray()),
      { defaultValue: [] as CheckResult[] },
    );

    const errors = all.filter((r) => !r.passed && r.check.severity === 'error');
    const warnings = all.filter((r) => !r.passed && r.check.severity === 'warning');
    const infos = all.filter((r) => !r.passed && r.check.severity === 'info');

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      infos,
      all,
      duration: Date.now() - startedAt,
    };
  }
}

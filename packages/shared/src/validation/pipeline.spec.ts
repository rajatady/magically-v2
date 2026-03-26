import { of, throwError } from 'rxjs';
import { ValidationPipeline } from './pipeline';
import type { ValidationCheck, ValidationContext, CheckResult } from './types';

function makeCheck(
  id: string,
  passed: boolean,
  severity: 'error' | 'warning' | 'info' = 'error',
  phase: 'pre-upload' | 'pre-build' | 'post-build' = 'pre-upload',
): ValidationCheck {
  return {
    meta: { id, name: id, severity, phase, category: 'structure' },
    validate: () => of({
      check: { id, name: id, severity, phase, category: 'structure' as const },
      passed,
      message: passed ? `${id} passed` : `${id} failed`,
    }),
  };
}

function makeCtx(): ValidationContext {
  return { agentDir: '/tmp/test-agent', manifest: null, files: [], data: new Map() };
}

describe('ValidationPipeline', () => {
  it('runs all checks and returns aggregated result', async () => {
    const pipeline = new ValidationPipeline([
      makeCheck('check-a', true),
      makeCheck('check-b', true),
    ]);

    const result = await pipeline.run(makeCtx());

    expect(result.passed).toBe(true);
    expect(result.all).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if any error-severity check fails', async () => {
    const pipeline = new ValidationPipeline([
      makeCheck('good', true),
      makeCheck('bad', false, 'error'),
    ]);

    const result = await pipeline.run(makeCtx());

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].check.id).toBe('bad');
  });

  it('passes with only warning failures', async () => {
    const pipeline = new ValidationPipeline([
      makeCheck('good', true),
      makeCheck('warn', false, 'warning'),
    ]);

    const result = await pipeline.run(makeCtx());

    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it('filters checks by phase', async () => {
    const pipeline = new ValidationPipeline([
      makeCheck('pre', true, 'error', 'pre-upload'),
      makeCheck('build', true, 'error', 'pre-build'),
      makeCheck('post', true, 'error', 'post-build'),
    ]);

    const result = await pipeline.run(makeCtx(), 'pre-upload');

    expect(result.all).toHaveLength(1);
    expect(result.all[0].check.id).toBe('pre');
  });

  it('short-circuits on fatal error when shortCircuit is true', async () => {
    let secondRan = false;

    const failing: ValidationCheck = {
      meta: { id: 'fatal', name: 'fatal', severity: 'error', phase: 'pre-upload', category: 'structure' },
      validate: () => of({ check: { id: 'fatal', name: 'fatal', severity: 'error' as const, phase: 'pre-upload' as const, category: 'structure' as const }, passed: false, message: 'fatal' }),
    };

    const second: ValidationCheck = {
      meta: { id: 'second', name: 'second', severity: 'error', phase: 'pre-upload', category: 'structure' },
      validate: () => {
        secondRan = true;
        return of({ check: { id: 'second', name: 'second', severity: 'error' as const, phase: 'pre-upload' as const, category: 'structure' as const }, passed: true, message: 'ok' });
      },
    };

    const pipeline = new ValidationPipeline([failing, second]);
    const result = await pipeline.run(makeCtx(), undefined, { shortCircuit: true });

    expect(result.passed).toBe(false);
    expect(secondRan).toBe(false);
  });

  it('handles checks that throw by converting to error result', async () => {
    const throws: ValidationCheck = {
      meta: { id: 'crasher', name: 'crasher', severity: 'error', phase: 'pre-upload', category: 'structure' },
      validate: () => throwError(() => new Error('boom')),
    };

    const pipeline = new ValidationPipeline([throws]);
    const result = await pipeline.run(makeCtx());

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('boom');
  });

  it('emits results via observable for real-time progress', (done) => {
    const pipeline = new ValidationPipeline([
      makeCheck('a', true),
      makeCheck('b', true),
      makeCheck('c', false, 'warning'),
    ]);

    const results: CheckResult[] = [];
    pipeline.stream(makeCtx()).subscribe({
      next: (r) => results.push(r),
      complete: () => {
        expect(results).toHaveLength(3);
        done();
      },
    });
  });
});

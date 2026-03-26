import { Observable } from 'rxjs';

// ─── Severity ────────────────────────────────────────────────────────────────

export type CheckSeverity = 'error' | 'warning' | 'info';

// ─── Phase ───────────────────────────────────────────────────────────────────

export type CheckPhase = 'pre-upload' | 'pre-build' | 'post-build';

// ─── Category ────────────────────────────────────────────────────────────────

export type CheckCategory = 'structure' | 'security' | 'quality' | 'compatibility';

// ─── Check metadata ──────────────────────────────────────────────────────────

export interface CheckMeta {
  id: string;
  name: string;
  severity: CheckSeverity;
  phase: CheckPhase;
  category: CheckCategory;
}

// ─── Validation context ──────────────────────────────────────────────────────

export interface ValidationContext {
  /** Absolute path to the agent directory */
  agentDir: string;
  /** Parsed manifest (null if manifest check hasn't run yet) */
  manifest: Record<string, unknown> | null;
  /** Files discovered in the agent directory */
  files: string[];
  /** Accumulated data from previous checks (pass-through) */
  data: Map<string, unknown>;
}

// ─── Check result ────────────────────────────────────────────────────────────

export interface CheckResult {
  check: CheckMeta;
  passed: boolean;
  message: string;
  details?: string;
}

// ─── The check interface ─────────────────────────────────────────────────────

export interface ValidationCheck {
  readonly meta: CheckMeta;
  validate(ctx: ValidationContext): Observable<CheckResult>;
}

// ─── Pipeline result ─────────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  errors: CheckResult[];
  warnings: CheckResult[];
  infos: CheckResult[];
  all: CheckResult[];
  duration: number;
}

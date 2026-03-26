import { of } from 'rxjs';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { ValidationCheck, ValidationContext } from '../types';

const SECRET_PATTERNS = [
  { pattern: /(?:^|['"=\s])sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI API key' },
  { pattern: /(?:^|['"=\s])ghp_[a-zA-Z0-9]{36,}/, name: 'GitHub PAT' },
  { pattern: /(?:^|['"=\s])gho_[a-zA-Z0-9]{36,}/, name: 'GitHub OAuth token' },
  { pattern: /(?:^|['"=\s])AKIA[A-Z0-9]{16}/, name: 'AWS access key' },
  { pattern: /(?:^|['"=\s])xox[bpsa]-[a-zA-Z0-9-]+/, name: 'Slack token' },
  { pattern: /(?:^|['"=\s])EAA[a-zA-Z0-9]+/, name: 'Facebook/Meta access token' },
  { pattern: /(?:^|['"=\s])sq0[a-z]{3}-[a-zA-Z0-9-_]{22,}/, name: 'Square token' },
  { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private key' },
];

const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.ts', '.py', '.sh', '.json', '.yaml', '.yml', '.toml', '.env',
  '.cfg', '.conf', '.ini', '.md', '.txt',
]);

const IGNORE_DIRS = new Set(['node_modules', '.git', '__pycache__', '.venv', 'dist']);

function collectFiles(dir: string, result: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        collectFiles(join(dir, entry.name), result);
      }
    } else if (SCANNABLE_EXTENSIONS.has(extname(entry.name))) {
      result.push(join(dir, entry.name));
    }
  }
  return result;
}

export const noHardcodedSecrets: ValidationCheck = {
  meta: {
    id: 'no-hardcoded-secrets',
    name: 'No hardcoded API keys or secrets',
    severity: 'error',
    phase: 'pre-build',
    category: 'security',
  },

  validate(ctx: ValidationContext) {
    const files = collectFiles(ctx.agentDir);
    const findings: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const relativePath = file.replace(ctx.agentDir + '/', '');

      for (const { pattern, name } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          findings.push(`${relativePath}: possible ${name}`);
        }
      }
    }

    if (findings.length > 0) {
      return of({
        check: this.meta,
        passed: false,
        message: `Found ${findings.length} potential hardcoded secret(s)`,
        details: findings.join('\n'),
      });
    }

    return of({
      check: this.meta,
      passed: true,
      message: `Scanned ${files.length} files — no secrets detected`,
    });
  },
};

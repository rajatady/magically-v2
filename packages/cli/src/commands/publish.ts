import { readFileSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { authCommand } from './auth';
import { createPublishPipeline, HARNESS_SCRIPT, type ValidationContext } from '@magically/shared';

interface PublishResult {
  agentId: string;
  version: string;
  versionId: string;
  status: string;
}

interface VersionStatus {
  status: string;
  buildError?: string | null;
  imageRef?: string | null;
}

export const publishCommand = {
  parseManifest(agentDir: string): Record<string, any> {
    const manifestPath = join(agentDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`manifest.json not found in ${agentDir}`);
    }
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  },

  createBundle(agentDir: string): Buffer {
    const tmpPath = join(tmpdir(), `magically-bundle-${Date.now()}.tar.gz`);
    const parent = join(agentDir, '..');
    const dirName = basename(agentDir);

    execSync(`tar czf ${tmpPath} -C ${parent} ${dirName}`, { stdio: 'pipe' });
    const buffer = readFileSync(tmpPath);

    try { execSync(`rm ${tmpPath}`, { stdio: 'ignore' }); } catch {}
    return buffer;
  },

  async sendPublish(
    base: string,
    token: string,
    manifest: Record<string, any>,
    bundle: Buffer,
  ): Promise<PublishResult> {
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('bundle', new Blob([new Uint8Array(bundle)]), 'bundle.tar.gz');

    const res = await fetch(`${base}/api/registry/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Publish failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<PublishResult>;
  },

  async pollStatus(
    base: string,
    token: string,
    agentId: string,
    version: string,
    intervalMs = 5000,
    maxAttempts = 120,
  ): Promise<VersionStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(
        `${base}/api/registry/agents/${agentId}/versions/${version}/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) throw new Error(`Status check failed (${res.status})`);

      const status = await res.json() as VersionStatus;

      if (status.status === 'live' || status.status === 'failed') {
        return status;
      }

      await new Promise(r => setTimeout(r, intervalMs));
    }

    return { status: 'failed', buildError: 'Timed out waiting for build' };
  },

  async exec(agentDir: string, opts: { base: string; wait?: boolean; validateOnly?: boolean }): Promise<void> {
    // Validate before publishing
    console.log('Validating agent...');
    const pipeline = createPublishPipeline();
    const ctx: ValidationContext = {
      agentDir,
      manifest: null,
      files: [],
      data: new Map(),
    };

    const validation = await pipeline.run(ctx, 'pre-upload', { shortCircuit: true });

    for (const r of validation.all) {
      const icon = r.passed ? '  ✓' : r.check.severity === 'error' ? '  ✗' : '  ⚠';
      console.log(`${icon} ${r.check.name}${r.passed ? '' : ': ' + r.message}`);
    }

    if (!validation.passed) {
      console.error('\nValidation failed. Fix the errors above before publishing.');
      process.exit(1);
    }

    if (validation.warnings.length > 0) {
      console.log(`\n${validation.warnings.length} warning(s).`);
    }

    console.log(`\nValidation completed in ${validation.duration}ms.`);

    if (opts.validateOnly) return;

    const token = authCommand.loadToken();
    if (!token) {
      console.error('Not logged in. Run: magically login');
      process.exit(1);
    }

    const manifest = ctx.manifest as Record<string, string>;
    console.log(`Publishing ${manifest.id}@${manifest.version}...`);

    // Inject harness script for container agents with JS functions
    const harnessPath = join(agentDir, '_harness.js');
    if (manifest.runtime) {
      writeFileSync(harnessPath, HARNESS_SCRIPT);
    }

    // Bundle the agent directory
    console.log('Bundling agent...');
    const bundle = publishCommand.createBundle(agentDir);
    console.log(`Bundle: ${(bundle.length / 1024).toFixed(1)} KB`);

    // Clean up injected harness
    try { unlinkSync(harnessPath); } catch {}

    // Send to runtime
    const result = await publishCommand.sendPublish(opts.base, token, manifest, bundle);
    console.log(`Accepted: ${result.agentId}@${result.version} (${result.status})`);

    // If processing, wait for build
    if (result.status === 'processing') {
      console.log('Building image...');
      const final = await publishCommand.pollStatus(
        opts.base,
        token,
        result.agentId,
        manifest.version,
      );

      if (final.status === 'live') {
        console.log(`Live! Image: ${final.imageRef}`);
      } else {
        console.error(`Build failed: ${final.buildError}`);
        process.exit(1);
      }
    }
  },
};

import { Injectable, Logger } from '@nestjs/common';
import { build } from 'esbuild';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';

interface BundleCache {
  js: string;
  builtAt: number;
  sourceMtime: number;
}

const RUNTIME_URL = 'http://localhost:4321';

@Injectable()
export class AgentUiService {
  private readonly logger = new Logger(AgentUiService.name);
  private cache = new Map<string, BundleCache>();

  /**
   * Returns an HTML page that mounts the agent's React app.
   *
   * Dev mode (NODE_ENV !== 'production'):
   *   Uses esbuild to bundle the agent's ui/App.tsx on-demand.
   *   Result is cached and invalidated when the source file changes.
   *
   * Production mode:
   *   Serves agents/:id/dist/index.html built by `vite build`.
   */
  async getUiHtml(agentId: string, agentDir: string, manifest: { name: string; icon?: string; color?: string }): Promise<string> {
    if (process.env.NODE_ENV === 'production') {
      return this.serveProdBundle(agentId, agentDir, manifest);
    }
    return this.serveDevBundle(agentId, agentDir, manifest);
  }

  // ─── Production ────────────────────────────────────────────────────────────

  private serveProdBundle(agentId: string, agentDir: string, manifest: { name: string; icon?: string }): string {
    const distIndex = join(agentDir, 'dist', 'index.html');
    if (!existsSync(distIndex)) {
      return this.errorPage(agentId, `No production build found. Run: magically build ${agentId}`);
    }
    return readFileSync(distIndex, 'utf-8');
  }

  // ─── Dev (esbuild on-demand) ───────────────────────────────────────────────

  private async serveDevBundle(agentId: string, agentDir: string, manifest: { name: string; icon?: string; color?: string }): Promise<string> {
    const entryFile = this.findEntry(agentDir);
    if (!entryFile) {
      return this.errorPage(agentId, `No UI entry found. Expected ui/App.tsx or ui/App.jsx in ${agentDir}`);
    }

    try {
      const js = await this.bundle(agentId, entryFile);
      return this.shellHtml(manifest, js);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`esbuild failed for ${agentId}: ${msg}`);
      return this.errorPage(agentId, msg);
    }
  }

  private findEntry(agentDir: string): string | null {
    const candidates = [
      join(agentDir, 'ui', 'App.tsx'),
      join(agentDir, 'ui', 'App.jsx'),
      join(agentDir, 'ui', 'index.tsx'),
      join(agentDir, 'ui', 'index.jsx'),
    ];
    return candidates.find((p) => existsSync(p)) ?? null;
  }

  private async bundle(agentId: string, entryFile: string): Promise<string> {
    const mtime = statSync(entryFile).mtimeMs;
    const cached = this.cache.get(agentId);

    if (cached && cached.sourceMtime === mtime) {
      return cached.js;
    }

    this.logger.log(`Bundling ${agentId} via esbuild...`);

    // Synthetic entry: import the agent's App + mount it via react-dom/client
    const entry = [
      `import App from ${JSON.stringify(entryFile)};`,
      `import { createRoot } from 'react-dom/client';`,
      `import { createElement } from 'react';`,
      `createRoot(document.getElementById('root')).render(createElement(App, null));`,
    ].join('\n');

    const result = await build({
      stdin: {
        contents: entry,
        resolveDir: dirname(entryFile),
        loader: 'tsx',
      },
      bundle: true,
      write: false,
      format: 'iife',
      jsx: 'automatic',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'css',
      },
      define: {
        'process.env.NODE_ENV': '"development"',
        'process.env.RUNTIME_URL': `"${RUNTIME_URL}"`,
      },
      sourcemap: 'inline',
      minify: false,
    });

    const js = result.outputFiles[0]?.text ?? '';
    this.cache.set(agentId, { js, builtAt: Date.now(), sourceMtime: mtime });

    return js;
  }

  // ─── HTML shell ────────────────────────────────────────────────────────────

  private shellHtml(manifest: { name: string; icon?: string; color?: string }, js: string): string {
    const accent = manifest.color ?? '#f97316';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${manifest.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --accent: ${accent};
      --bg: #0a0a0b;
      --text: #f4f4f5;
      --text-2: #a1a1aa;
    }
    html, body, #root { height: 100%; width: 100%; background: var(--bg); color: var(--text); }
    body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>

  <!-- Agent bundle: React + agent component + mount, all bundled by esbuild -->
  <script>
${js}
  </script>
</body>
</html>`;
  }

  private errorPage(agentId: string, message: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Error — ${agentId}</title>
<style>body{background:#0a0a0b;color:#f4f4f5;font-family:monospace;padding:24px}</style>
</head><body>
<h2 style="color:#ef4444;margin-bottom:12px">⚠ Agent UI Error</h2>
<pre style="color:#a1a1aa;white-space:pre-wrap">${message}</pre>
</body></html>`;
  }
}

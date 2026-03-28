/**
 * Scaffold a new agent from the template directory.
 * Copies all files, replaces {{placeholders}} with provided values.
 *
 * Used by both CLI (magically init) and runtime (Zeus workspace bootstrap).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, relative } from 'path';

export interface ScaffoldVars {
  agentId: string;
  agentName: string;
  agentDescription: string;
}

/**
 * Resolve the path to the agent template directory.
 * Templates live at packages/shared/templates/agent/ relative to the shared package root.
 */
export function getTemplatePath(): string {
  // __dirname in CJS compiled output points to dist/
  // Templates are at ../templates/agent/ relative to dist/
  return join(__dirname, '..', 'templates', 'agent');
}

/**
 * Copy the agent template to a target directory, replacing {{placeholders}}.
 */
export function scaffoldAgent(targetDir: string, vars: ScaffoldVars): void {
  const templateDir = getTemplatePath();
  copyDirWithReplacements(templateDir, targetDir, vars);
}

function copyDirWithReplacements(src: string, dest: string, vars: ScaffoldVars): void {
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirWithReplacements(srcPath, destPath, vars);
    } else {
      // Only replace in text files (not binary)
      const ext = entry.split('.').pop() ?? '';
      const textExtensions = ['json', 'js', 'ts', 'md', 'txt', 'yaml', 'yml', 'toml', 'cfg', 'gitignore'];
      const isText = textExtensions.includes(ext) || entry.startsWith('.');

      if (isText) {
        let content = readFileSync(srcPath, 'utf-8');
        content = content
          .replace(/\{\{agentId\}\}/g, vars.agentId)
          .replace(/\{\{agentName\}\}/g, vars.agentName)
          .replace(/\{\{agentDescription\}\}/g, vars.agentDescription);
        writeFileSync(destPath, content);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }
  }
}

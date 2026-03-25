import { buildCommand, generateDockerfile } from './build';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('build command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `magically-cli-build-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('generateDockerfile', () => {
    it('generates a Dockerfile from runtime config', () => {
      const df = generateDockerfile({
        base: 'python:3.12-slim',
        system: ['chromium', 'fonts-noto'],
        install: 'pip install playwright && playwright install chromium --with-deps',
      });

      expect(df).toContain('FROM python:3.12-slim');
      expect(df).toContain('WORKDIR /agent');
      expect(df).toContain('COPY . /agent/');
      expect(df).toContain('apt-get install -y chromium fonts-noto');
      expect(df).toContain('pip install playwright');
    });

    it('skips apt-get when no system deps', () => {
      const df = generateDockerfile({ base: 'node:22-slim' });
      expect(df).not.toContain('apt-get');
    });

    it('skips RUN when no install command', () => {
      const df = generateDockerfile({ base: 'python:3.12-slim', system: ['curl'] });
      const lines = df.split('\n');
      const runLines = lines.filter(l => l.startsWith('RUN'));
      expect(runLines.length).toBe(1); // only apt-get
    });
  });

  describe('buildCommand.parseManifest', () => {
    it('reads and validates manifest from agent dir', () => {
      writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify({
        id: 'test-agent',
        name: 'Test',
        version: '1.0.0',
        runtime: { base: 'python:3.12-slim' },
        functions: [],
      }));

      const manifest = buildCommand.parseManifest(tmpDir);
      expect(manifest.id).toBe('test-agent');
      expect(manifest.runtime?.base).toBe('python:3.12-slim');
    });

    it('throws if manifest.json is missing', () => {
      expect(() => buildCommand.parseManifest(tmpDir)).toThrow(/manifest.json/);
    });

    it('throws if agent has no runtime block', () => {
      writeFileSync(join(tmpDir, 'manifest.json'), JSON.stringify({
        id: 'lightweight',
        name: 'Light',
        version: '1.0.0',
        functions: [],
      }));

      expect(() => buildCommand.parseManifest(tmpDir)).toThrow(/no runtime/i);
    });
  });

  describe('buildCommand.imageTag', () => {
    it('generates correct image tag', () => {
      const tag = buildCommand.imageTag('my-agent', '2.0.0');
      expect(tag).toBe('magically-agent-my-agent:2.0.0');
    });
  });
});

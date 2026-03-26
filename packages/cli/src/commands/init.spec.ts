import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initCommand } from './init';

describe('initCommand', () => {
  let tmpDir: string;
  let agentDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `magically-cli-init-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    agentDir = join(tmpDir, 'test-agent');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('exec', () => {
    it('creates the agent directory with correct structure', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test agent',
      });

      expect(existsSync(agentDir)).toBe(true);
      expect(existsSync(join(agentDir, 'manifest.json'))).toBe(true);
      expect(existsSync(join(agentDir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(agentDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(agentDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(agentDir, 'functions', 'hello.js'))).toBe(true);
    });

    it('uses agent ID as directory name when dir not provided', async () => {
      // When targetDir is undefined, exec uses the ID as the directory name (relative to cwd)
      const expectedDir = join(process.cwd(), 'test-dir-agent');
      try {
        await initCommand.exec(undefined, {
          name: 'Test Dir Agent',
          id: 'test-dir-agent',
          description: 'Tests directory naming',
        });
        expect(existsSync(expectedDir)).toBe(true);
        const manifest = JSON.parse(readFileSync(join(expectedDir, 'manifest.json'), 'utf-8'));
        expect(manifest.id).toBe('test-dir-agent');
      } finally {
        rmSync(expectedDir, { recursive: true, force: true });
      }
    });

    it('generates a valid manifest.json', async () => {
      await initCommand.exec(agentDir, {
        name: 'My Cool Agent',
        id: 'my-cool-agent',
        description: 'Does cool things',
      });

      const manifest = JSON.parse(readFileSync(join(agentDir, 'manifest.json'), 'utf-8'));
      expect(manifest.id).toBe('my-cool-agent');
      expect(manifest.name).toBe('My Cool Agent');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.description).toBe('Does cool things');
      expect(Array.isArray(manifest.functions)).toBe(true);
      expect(manifest.functions.length).toBeGreaterThan(0);
      expect(manifest.functions[0].name).toBe('hello');
    });

    it('CLAUDE.md imports AGENTS.md', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const claudeMd = readFileSync(join(agentDir, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('@AGENTS.md');
    });

    it('AGENTS.md contains essential agent development context', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const agentsMd = readFileSync(join(agentDir, 'AGENTS.md'), 'utf-8');
      expect(agentsMd).toContain('Test Agent');
      expect(agentsMd).toContain('module.exports');
      expect(agentsMd).toContain('ctx');
      expect(agentsMd).toContain('magically publish');
      expect(agentsMd).toContain('magically run');
      expect(agentsMd).toContain('@docs/');
    });

    it('creates .claude/skills/ with all required skills', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const skillsDir = join(agentDir, '.claude', 'skills');
      const requiredSkills = ['publish', 'run', 'validate', 'add-function', 'add-trigger', 'status'];

      for (const skill of requiredSkills) {
        const skillFile = join(skillsDir, skill, 'SKILL.md');
        expect(existsSync(skillFile)).toBe(true);

        const content = readFileSync(skillFile, 'utf-8');
        expect(content).toContain('---');
        expect(content).toContain(`name: ${skill}`);
      }
    });

    it('creates .claude/settings.json with permissions', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const settings = JSON.parse(readFileSync(join(agentDir, '.claude', 'settings.json'), 'utf-8'));
      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.allow).toBeDefined();
      expect(Array.isArray(settings.permissions.allow)).toBe(true);
    });

    it('creates docs/ with reference files', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const docsDir = join(agentDir, 'docs');
      const requiredDocs = [
        'manifest-reference.md',
        'function-contract.md',
        'triggers-and-config.md',
        'publish-pipeline.md',
      ];

      for (const doc of requiredDocs) {
        expect(existsSync(join(docsDir, doc))).toBe(true);
        const content = readFileSync(join(docsDir, doc), 'utf-8');
        expect(content.length).toBeGreaterThan(100);
      }
    });

    it('creates a working hello.js function with module.exports pattern', async () => {
      await initCommand.exec(agentDir, {
        name: 'Test Agent',
        id: 'test-agent',
        description: 'A test',
      });

      const helloJs = readFileSync(join(agentDir, 'functions', 'hello.js'), 'utf-8');
      expect(helloJs).toContain('module.exports');
      expect(helloJs).toContain('async function');
      expect(helloJs).toContain('ctx');
    });

    it('throws if directory already exists and has files', async () => {
      mkdirSync(agentDir, { recursive: true });
      require('fs').writeFileSync(join(agentDir, 'manifest.json'), '{}');

      await expect(
        initCommand.exec(agentDir, {
          name: 'Test Agent',
          id: 'test-agent',
          description: 'A test',
        }),
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('deriveId', () => {
    it('converts name to lowercase hyphenated id', () => {
      expect(initCommand.deriveId('My Cool Agent')).toBe('my-cool-agent');
    });

    it('strips special characters', () => {
      expect(initCommand.deriveId('Agent #1 (Beta)')).toBe('agent-1-beta');
    });

    it('collapses multiple hyphens', () => {
      expect(initCommand.deriveId('My  Agent')).toBe('my-agent');
    });

    it('handles unicode and diacritics', () => {
      expect(initCommand.deriveId('Café Résumé')).toBe('cafe-resume');
    });

    it('handles emojis gracefully', () => {
      expect(initCommand.deriveId('🚀 My Agent 🎉')).toBe('my-agent');
    });

    it('returns fallback for all-special-chars input', () => {
      expect(initCommand.deriveId('!!!@@@###')).toBe('my-agent');
    });

    it('returns fallback for empty string', () => {
      expect(initCommand.deriveId('')).toBe('my-agent');
    });

    it('returns fallback for whitespace-only input', () => {
      expect(initCommand.deriveId('   ')).toBe('my-agent');
    });

    it('handles numbers at start', () => {
      expect(initCommand.deriveId('123 Agent')).toBe('123-agent');
    });

    it('strips leading and trailing hyphens', () => {
      expect(initCommand.deriveId('-agent-')).toBe('agent');
    });
  });

  describe('validateId', () => {
    it('accepts valid ids', () => {
      expect(initCommand.validateId('my-agent')).toBeNull();
      expect(initCommand.validateId('agent123')).toBeNull();
      expect(initCommand.validateId('a')).toBeNull();
    });

    it('rejects empty string', () => {
      expect(initCommand.validateId('')).not.toBeNull();
    });

    it('rejects uppercase', () => {
      expect(initCommand.validateId('MyAgent')).not.toBeNull();
    });

    it('rejects special characters', () => {
      expect(initCommand.validateId('my_agent')).not.toBeNull();
      expect(initCommand.validateId('my.agent')).not.toBeNull();
      expect(initCommand.validateId('my agent')).not.toBeNull();
    });

    it('rejects leading/trailing hyphens', () => {
      expect(initCommand.validateId('-agent')).not.toBeNull();
      expect(initCommand.validateId('agent-')).not.toBeNull();
    });

    it('rejects overly long ids', () => {
      expect(initCommand.validateId('a'.repeat(129))).not.toBeNull();
    });
  });

  describe('sanitizeFunctionName', () => {
    it('converts space-separated words to camelCase', () => {
      expect(initCommand.sanitizeFunctionName('my function name')).toBe('myFunctionName');
    });

    it('converts hyphen-separated words to camelCase', () => {
      expect(initCommand.sanitizeFunctionName('fetch-data')).toBe('fetchData');
    });

    it('strips special characters', () => {
      expect(initCommand.sanitizeFunctionName('hello!@#world')).toBe('helloworld');
    });

    it('returns fallback for empty input', () => {
      expect(initCommand.sanitizeFunctionName('')).toBe('myFunction');
    });

    it('returns fallback for all-special-chars input', () => {
      expect(initCommand.sanitizeFunctionName('!!!###')).toBe('myFunction');
    });

    it('handles single word', () => {
      expect(initCommand.sanitizeFunctionName('greet')).toBe('greet');
    });

    it('preserves existing camelCase', () => {
      // lowercase each part, so MyFunc → myfunc — that's expected
      expect(initCommand.sanitizeFunctionName('fetchData')).toBe('fetchdata');
    });
  });

  describe('container mode', () => {
    it('includes runtime block when --container flag is set', async () => {
      await initCommand.exec(agentDir, {
        name: 'Container Agent',
        id: 'container-agent',
        description: 'Runs in Docker',
        container: true,
      });

      const manifest = JSON.parse(readFileSync(join(agentDir, 'manifest.json'), 'utf-8'));
      expect(manifest.runtime).toBeDefined();
      expect(manifest.runtime.base).toBeDefined();
    });

    it('uses custom base image when --base is provided', async () => {
      await initCommand.exec(agentDir, {
        name: 'Python Agent',
        id: 'python-agent',
        description: 'Python agent',
        container: true,
        base: 'python:3.12-slim',
      });

      const manifest = JSON.parse(readFileSync(join(agentDir, 'manifest.json'), 'utf-8'));
      expect(manifest.runtime.base).toBe('python:3.12-slim');
    });

    it('omits runtime block for lightweight agents (default)', async () => {
      await initCommand.exec(agentDir, {
        name: 'Light Agent',
        id: 'light-agent',
        description: 'No container',
      });

      const manifest = JSON.parse(readFileSync(join(agentDir, 'manifest.json'), 'utf-8'));
      expect(manifest.runtime).toBeUndefined();
    });
  });
});

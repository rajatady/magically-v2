import { join } from 'path';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { authCommand } from './auth';

describe('auth command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `magically-cli-auth-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('credentials file', () => {
    it('saves token to credentials file', () => {
      authCommand.saveToken('test-token-123', tmpDir);
      const creds = JSON.parse(readFileSync(join(tmpDir, 'credentials.json'), 'utf-8'));
      expect(creds.token).toBe('test-token-123');
    });

    it('reads token from credentials file', () => {
      authCommand.saveToken('my-token', tmpDir);
      expect(authCommand.loadToken(tmpDir)).toBe('my-token');
    });

    it('returns null when no credentials file', () => {
      expect(authCommand.loadToken(tmpDir)).toBeNull();
    });

    it('clears credentials on logout', () => {
      authCommand.saveToken('my-token', tmpDir);
      authCommand.clearToken(tmpDir);
      expect(authCommand.loadToken(tmpDir)).toBeNull();
      expect(existsSync(join(tmpDir, 'credentials.json'))).toBe(false);
    });
  });

  describe('loginUrl', () => {
    it('builds the OAuth login URL', () => {
      const url = authCommand.loginUrl('http://localhost:4321');
      expect(url).toBe('http://localhost:4321/api/auth/google');
    });
  });
});

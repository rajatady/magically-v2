import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { createServer } from 'http';

const DEFAULT_DIR = join(homedir(), '.magically');

export const authCommand = {
  saveToken(token: string, dir = DEFAULT_DIR): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'credentials.json'), JSON.stringify({ token }, null, 2));
  },

  loadToken(dir = DEFAULT_DIR): string | null {
    const path = join(dir, 'credentials.json');
    if (!existsSync(path)) return null;
    try {
      const creds = JSON.parse(readFileSync(path, 'utf-8'));
      return creds.token ?? null;
    } catch {
      return null;
    }
  },

  clearToken(dir = DEFAULT_DIR): void {
    const path = join(dir, 'credentials.json');
    if (existsSync(path)) unlinkSync(path);
  },

  loginUrl(base: string): string {
    return `${base}/api/auth/google`;
  },

  /** Open browser for Google OAuth, start a local server to catch the redirect with the token. */
  async loginWithBrowser(base: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const port = 9876;

      const server = createServer((req, res) => {
        const url = new URL(req.url ?? '', `http://localhost:${port}`);
        const token = url.searchParams.get('token');

        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Logged in! You can close this tab.</h2><script>window.close()</script></body></html>');
          server.close();
          resolve(token);
        } else {
          res.writeHead(400);
          res.end('Missing token');
          server.close();
          reject(new Error('No token received'));
        }
      });

      server.listen(port, () => {
        // The Google OAuth callback redirects to WEB_URL/auth/callback?token=...
        // For CLI, we redirect to our local server instead.
        // We append a cli_redirect param so the runtime knows to redirect back to us.
        const loginUrl = `${base}/api/auth/google?cli_redirect=http://localhost:${port}`;
        console.log(`Opening browser for login...`);
        console.log(`If browser doesn't open, visit: ${loginUrl}`);

        // Open browser
        const platform = process.platform;
        try {
          if (platform === 'darwin') execSync(`open "${loginUrl}"`);
          else if (platform === 'win32') execSync(`start "${loginUrl}"`);
          else execSync(`xdg-open "${loginUrl}"`);
        } catch {
          // Browser open failed — user can visit the URL manually
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Login timed out after 2 minutes'));
      }, 120_000);
    });
  },

  async exec(opts: { base: string; token?: string }): Promise<void> {
    if (opts.token) {
      // Direct token login
      authCommand.saveToken(opts.token);
      console.log('Token saved. You are logged in.');
      return;
    }

    // Browser-based login
    try {
      const token = await authCommand.loginWithBrowser(opts.base);
      authCommand.saveToken(token);
      console.log('Logged in successfully.');
    } catch (err: any) {
      console.error(`Login failed: ${err.message}`);
      process.exit(1);
    }
  },

  execLogout(): void {
    authCommand.clearToken();
    console.log('Logged out.');
  },
};

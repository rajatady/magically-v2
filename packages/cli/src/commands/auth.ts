import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { createServer } from 'http';

const DEFAULT_DIR = join(homedir(), '.magically');

export const authCommand = {
  onLoginSuccess: null as (() => void) | null,

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
          res.end(`<!DOCTYPE html>
<html><head><title>Magically</title></head>
<body style="background:#0a0a0b;color:#e8e8ed;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
<div style="font-size:48px;margin-bottom:16px">&#10003;</div>
<h2 style="margin:0 0 8px">Logged in to Magically</h2>
<p style="color:#6b6b76">You can close this tab and return to the terminal.</p>
</div>
<script>setTimeout(()=>window.close(),1500)</script>
</body></html>`);
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
        // Open the web login page with cli_redirect param.
        // After login (any method), the web app redirects the token to our local server.
        const webUrl = process.env.WEB_URL ?? 'http://localhost:5173';
        const loginUrl = `${webUrl}/login?cli_redirect=http://localhost:${port}`;
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
      console.log('Logged in successfully.\n');
      if (authCommand.onLoginSuccess) authCommand.onLoginSuccess();
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

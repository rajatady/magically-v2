import { authCommand } from './auth';

export const runCommand = {
  buildUrl(base: string, agentId: string, functionName: string): string {
    const clean = base.replace(/\/$/, '');
    return `${clean}/api/agents/${agentId}/run/${functionName}`;
  },

  parsePayload(raw?: string): Record<string, unknown> {
    if (!raw) return {};
    return JSON.parse(raw);
  },

  async exec(agentId: string, functionName: string, opts: {
    base?: string;
    payload?: string;
  } = {}): Promise<void> {
    const base = opts.base ?? 'http://localhost:4321';
    const url = runCommand.buildUrl(base, agentId, functionName);
    const body = runCommand.parsePayload(opts.payload);

    console.log(`Running ${agentId}/${functionName}...`);

    const token = authCommand.loadToken();
    if (!token) {
      console.error('Not logged in. Run: magically login');
      process.exit(1);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`FAILED (HTTP ${res.status}): ${text}`);
      return;
    }

    const result = await res.json();

    if (result.status === 'success') {
      console.log(`OK (${result.durationMs}ms)`);
      if (result.result) console.log(JSON.stringify(result.result, null, 2));
    } else {
      console.error(`FAILED: ${result.error ?? 'unknown error'}`);
    }

    if (result.logs?.length) {
      console.log('\nLogs:');
      for (const log of result.logs) {
        console.log(`  [${log.level.toUpperCase()}] ${log.message}`);
      }
    }
  },
};

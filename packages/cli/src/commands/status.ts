import { authCommand } from './auth';

interface VersionStatus {
  status: string;
  buildError?: string | null;
  imageRef?: string | null;
}

export const statusCommand = {
  async getStatus(
    base: string,
    token: string,
    agentId: string,
    version: string,
  ): Promise<VersionStatus> {
    const res = await fetch(
      `${base}/api/registry/agents/${agentId}/versions/${version}/status`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Status check failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<VersionStatus>;
  },

  async getLatestVersion(base: string, token: string, agentId: string): Promise<string> {
    const res = await fetch(
      `${base}/api/registry/agents/${agentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) throw new Error(`Agent ${agentId} not found`);
    const agent = await res.json() as any;
    return agent.latestVersion;
  },

  async exec(agentId: string, opts: { base: string; version?: string }): Promise<void> {
    const token = authCommand.loadToken();
    if (!token) {
      console.error('Not logged in. Run: magically login');
      process.exit(1);
    }

    const version = opts.version ?? await statusCommand.getLatestVersion(opts.base, token, agentId);
    const status = await statusCommand.getStatus(opts.base, token, agentId, version);

    console.log(`${agentId}@${version}`);
    console.log(`  Status: ${status.status}`);

    if (status.imageRef) {
      console.log(`  Image:  ${status.imageRef}`);
    }

    if (status.buildError) {
      console.error(`  Error:  ${status.buildError}`);
    }
  },
};

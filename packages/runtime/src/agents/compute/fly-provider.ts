import { ConfigService } from '@nestjs/config';
import { ComputeProvider, type ComputeRunInput, type ComputeRunOutput } from './compute-provider.js';

export class FlyProvider extends ComputeProvider {
  readonly name = 'fly';

  constructor(private readonly config: ConfigService) {
    super();
  }

  private get app(): string {
    const app = this.config.get<string>('FLY_AGENTS_APP');
    if (!app) throw new Error('FLY_AGENTS_APP not set');
    return app;
  }

  private get token(): string {
    const token = this.config.get<string>('FLY_API_TOKEN');
    if (!token) throw new Error('FLY_API_TOKEN not set');
    return token;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://api.machines.dev/v1/apps/${this.app}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Fly API ${method} ${path}: ${res.status} ${text}`);
    try { return JSON.parse(text) as T; } catch { return text as T; }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.get<string>('FLY_API_TOKEN') && !!this.config.get<string>('FLY_AGENTS_APP');
  }

  async buildImage(): Promise<void> {
    // For Fly, images must be pre-pushed to the registry.
    // No-op here — done via `fly deploy` or `scripts/push-agent.sh`.
  }

  async run(input: ComputeRunInput): Promise<ComputeRunOutput> {
    const { agentId, functionName, image, cmd, env, timeoutSeconds = 300 } = input;
    const startedAt = Date.now();
    const logs: string[] = [];

    // 1. Create machine
    const machine = await this.api<{ id: string; state: string }>('POST', '/machines', {
      config: {
        image,
        env,
        cmd,
        auto_destroy: false,
        restart: { policy: 'no' },
        guest: { cpu_kind: 'shared', cpus: 1, memory_mb: 512 },
      },
    });

    logs.push(`Machine ${machine.id} created for ${agentId}/${functionName}`);

    try {
      // 2. Wait for start
      await this.api('GET', `/machines/${machine.id}/wait?state=started&timeout=60`);

      // 3. Wait for stop
      const attempts = Math.ceil(Math.min(timeoutSeconds, 300) / 60);
      let stopped = false;

      for (let i = 0; i < attempts && !stopped; i++) {
        try {
          await this.api('GET', `/machines/${machine.id}/wait?state=stopped&timeout=60`);
          stopped = true;
        } catch {
          logs.push(`Still running... (${(i + 1) * 60}s)`);
        }
      }

      if (!stopped) {
        logs.push('Timeout — forcing stop');
        try { await this.api('POST', `/machines/${machine.id}/stop`); } catch {}
        await new Promise(r => setTimeout(r, 5000));
      }

      // 4. Get exit info
      const info = await this.api<any>('GET', `/machines/${machine.id}`);
      const exitEvent = info.events?.find((e: any) => e.type === 'exit');
      const exitCode = exitEvent?.status?.exit_code ?? (stopped ? 0 : 1);

      logs.push(`Machine stopped (exit_code=${exitCode})`);

      return { exitCode, logs, durationMs: Date.now() - startedAt };
    } finally {
      // 5. Always destroy
      try {
        await this.api('DELETE', `/machines/${machine.id}?force=true`);
        logs.push(`Machine ${machine.id} destroyed`);
      } catch {}
    }
  }
}

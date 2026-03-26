import { ConfigService } from '@nestjs/config';
import { ComputeProvider, type ComputeRunInput, type ComputeRunOutput } from './compute-provider';

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
        init: { cmd },
        auto_destroy: true,
        restart: { policy: 'no' },
        guest: { cpu_kind: 'shared', cpus: 1, memory_mb: 512 },
      },
    });

    logs.push(`Machine ${machine.id} created for ${agentId}/${functionName}`);

    // 2. Poll machine status until stopped or destroyed (auto_destroy: true)
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      try {
        const info = await this.api<{ id: string; state: string; events?: { type: string; status?: { exit_code?: number } }[] }>(
          'GET', `/machines/${machine.id}`,
        );

        if (info.state === 'stopped' || info.state === 'destroyed') {
          const exitEvent = info.events?.find((e) => e.type === 'exit');
          const exitCode = exitEvent?.status?.exit_code ?? 0;
          logs.push(`Machine completed (exit_code=${exitCode})`);
          return { exitCode, logs, durationMs: Date.now() - startedAt };
        }

        // Still running — wait before next poll
        await new Promise(r => setTimeout(r, 2000));
      } catch {
        // Machine no longer exists — auto_destroy cleaned it up. Assume success.
        logs.push('Machine auto-destroyed (assuming exit_code=0)');
        return { exitCode: 0, logs, durationMs: Date.now() - startedAt };
      }
    }

    // Timeout — force stop
    logs.push('Timeout — forcing stop');
    try { await this.api('POST', `/machines/${machine.id}/stop`); } catch {}
    return { exitCode: 1, logs, durationMs: Date.now() - startedAt };
  }
}

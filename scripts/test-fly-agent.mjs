#!/usr/bin/env node

/**
 * Test script: run an agent on Fly Machines end-to-end.
 *
 * Flow:
 * 1. Create a machine from the agent's image
 * 2. Wait for it to stop (function completed)
 * 3. Fetch logs
 * 4. Destroy the machine
 *
 * Usage:
 *   node scripts/test-fly-agent.mjs
 *
 * Requires: FLY_API_TOKEN env var (or reads from ~/.fly/config.yml)
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Config ─────────────────────────────────────────────────────────────────

const APP = 'coding-tips-pro-agent';
const API = 'https://api.machines.dev/v1';
const IMAGE = 'registry.fly.io/coding-tips-pro-agent:deployment-01KMH1B0ACCYTX908K92ATB749';
const CMD = ['python', 'insights.py', '--no-save'];

// ─── Token ──────────────────────────────────────────────────────────────────

function getToken() {
  if (process.env.FLY_API_TOKEN) return process.env.FLY_API_TOKEN;

  // Read from fly config
  try {
    const config = readFileSync(join(homedir(), '.fly', 'config.yml'), 'utf-8');
    const match = config.match(/^access_token:\s*(.+)$/m);
    if (match) {
      // Take first token (comma-separated)
      return match[1].split(',')[0].trim();
    }
  } catch {}

  throw new Error('No FLY_API_TOKEN found. Set env var or run `fly auth login`.');
}

const TOKEN = getToken();

// ─── API helpers ────────────────────────────────────────────────────────────

async function flyApi(method, path, body) {
  const url = `${API}/apps/${APP}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fly API ${method} ${path}: ${res.status} ${text}`);
  }

  try { return JSON.parse(text); } catch { return text; }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Fly Machines Agent Test ===\n');

  // 1. Create machine
  console.log('1. Creating machine...');
  const machine = await flyApi('POST', '/machines', {
    config: {
      image: IMAGE,
      env: {
        // No IG token — insights.py will fail gracefully, that's fine for testing
        MAGICALLY_FUNCTION: 'fetchInsights',
        MAGICALLY_AGENT_ID: 'coding-tips-pro',
      },
      cmd: CMD,
      auto_destroy: false,  // we destroy manually after reading logs
      restart: { policy: 'no' },
      guest: { cpu_kind: 'shared', cpus: 1, memory_mb: 512 },
    },
  });

  const machineId = machine.id;
  console.log(`   Machine created: ${machineId} (state: ${machine.state})`);

  // 2. Wait for it to start, then wait for it to stop
  console.log('2. Waiting for machine to start...');
  const startTime = Date.now();

  try {
    await flyApi('GET', `/machines/${machineId}/wait?state=started&timeout=30`);
    console.log('   Machine started.');
  } catch (err) {
    console.log(`   Start wait: ${err.message}`);
  }

  console.log('   Waiting for machine to stop...');
  // Poll in 60s windows until stopped (insights.py can take ~60-90s)
  let stopped = false;
  for (let attempt = 0; attempt < 3 && !stopped; attempt++) {
    try {
      await flyApi('GET', `/machines/${machineId}/wait?state=stopped&timeout=60`);
      stopped = true;
    } catch (err) {
      console.log(`   Still running... (attempt ${attempt + 1})`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (stopped) {
    console.log(`   Machine stopped after ${elapsed}s`);
  } else {
    console.log(`   Machine did not stop after ${elapsed}s — forcing stop`);
    try { await flyApi('POST', `/machines/${machineId}/stop`); } catch {}
    await new Promise(r => setTimeout(r, 5000));
  }

  // 3. Get machine info (exit code, events)
  console.log('3. Fetching machine status...');
  const info = await flyApi('GET', `/machines/${machineId}`);
  console.log(`   State: ${info.state}`);

  const exitEvent = info.events?.find(e => e.type === 'exit');
  if (exitEvent) {
    console.log(`   Exit code: ${exitEvent.status?.exit_code}`);
    console.log(`   OOM killed: ${exitEvent.status?.oom_killed}`);
  }

  // 4. Fetch logs via Fly Logs API (nats-based)
  console.log('4. Fetching logs...');
  try {
    // The logs endpoint uses a different API
    const logsRes = await fetch(`https://api.fly.io/api/v1/apps/${APP}/machines/${machineId}/logs`, {
      headers: { 'Authorization': `Bearer ${TOKEN}` },
    });

    if (logsRes.ok) {
      const logs = await logsRes.json();
      console.log(`   Got ${logs.length ?? '?'} log entries`);
      if (Array.isArray(logs)) {
        for (const entry of logs.slice(-20)) {
          console.log(`   [${entry.timestamp}] ${entry.message}`);
        }
      }
    } else {
      console.log(`   Logs API returned ${logsRes.status} — checking via events instead`);
    }
  } catch (err) {
    console.log(`   Could not fetch logs: ${err.message}`);
  }

  // Print all events as fallback
  console.log('\n   Machine events:');
  for (const event of (info.events || []).reverse()) {
    console.log(`   [${event.timestamp}] ${event.type} ${event.status ? JSON.stringify(event.status) : ''}`);
  }

  // 5. Destroy machine
  console.log('\n5. Destroying machine...');
  await flyApi('DELETE', `/machines/${machineId}?force=true`);
  console.log('   Machine destroyed.\n');

  console.log('=== Done ===');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

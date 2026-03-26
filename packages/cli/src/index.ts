#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import { buildCommand } from './commands/build';
import { pushCommand } from './commands/push';
import { runCommand } from './commands/run';
import { authCommand } from './commands/auth';
import { publishCommand } from './commands/publish';
import { statusCommand } from './commands/status';

const program = new Command();

program
  .name('magically')
  .description('Magically CLI — build, push, run, and manage agents')
  .version('0.1.0');

program
  .command('login')
  .description('Authenticate with Magically')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .option('--token <token>', 'API key or JWT token (skip browser login)')
  .action((opts: { base: string; token?: string }) => {
    authCommand.onLoginSuccess = () => program.outputHelp();
    authCommand.exec(opts);
  });

program
  .command('logout')
  .description('Clear stored credentials')
  .action(() => {
    authCommand.execLogout();
  });

program
  .command('whoami')
  .description('Show the currently authenticated user')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .action(async (opts: { base: string }) => {
    const token = authCommand.loadToken();
    if (!token) {
      console.log('Not logged in. Run: magically login');
      process.exit(1);
    }
    try {
      const res = await fetch(`${opts.base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.log('Token expired or invalid. Run: magically login');
        process.exit(1);
      }
      const user = await res.json() as any;
      console.log(`${user.email} (${user.sub})`);
    } catch (err: any) {
      console.error(`Failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('token')
  .description('Create an API key for scripts and automation')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .option('--name <name>', 'Key name', 'cli')
  .action(async (opts: { base: string; name: string }) => {
    const token = authCommand.loadToken();
    if (!token) {
      console.log('Not logged in. Run: magically login');
      process.exit(1);
    }
    try {
      const res = await fetch(`${opts.base}/api/auth/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: opts.name }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as any;
      console.log(data.rawKey);
    } catch (err: any) {
      console.error(`Failed: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('build [dir]')
  .description('Build a Docker image for a container agent')
  .action((dir?: string) => {
    buildCommand.exec(resolve(dir ?? '.'));
  });

program
  .command('push [dir]')
  .description('Push agent image to container registry')
  .requiredOption('--app <app>', 'Fly app name', process.env.FLY_AGENTS_APP)
  .action((dir: string | undefined, opts: { app: string }) => {
    pushCommand.exec(resolve(dir ?? '.'), opts.app);
  });

program
  .command('run <agentId> <functionName>')
  .description('Run an agent function via the runtime API')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .option('--payload <json>', 'JSON payload to pass to the function')
  .action((agentId: string, functionName: string, opts: { base: string; payload?: string }) => {
    runCommand.exec(agentId, functionName, opts);
  });

program
  .command('publish [dir]')
  .description('Publish an agent to the registry')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .option('--validate-only', 'Only run validation checks, do not publish')
  .action((dir: string | undefined, opts: { base: string; validateOnly?: boolean }) => {
    publishCommand.exec(resolve(dir ?? '.'), opts);
  });

program
  .command('status <agentId>')
  .description('Check build status of an agent')
  .option('--base <url>', 'Runtime base URL', 'http://localhost:4321')
  .option('--version <version>', 'Specific version to check')
  .action((agentId: string, opts: { base: string; version?: string }) => {
    statusCommand.exec(agentId, opts);
  });

program.parse();

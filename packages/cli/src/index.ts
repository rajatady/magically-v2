#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import { buildCommand } from './commands/build';
import { pushCommand } from './commands/push';
import { runCommand } from './commands/run';

const program = new Command();

program
  .name('magically')
  .description('Magically CLI — build, push, run, and manage agents')
  .version('0.1.0');

program
  .command('build [dir]')
  .description('Build a Docker image for a container agent')
  .action((dir?: string) => {
    buildCommand.exec(resolve(dir ?? '.'));
  });

program
  .command('push [dir]')
  .description('Push agent image to Fly.io registry')
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

program.parse();

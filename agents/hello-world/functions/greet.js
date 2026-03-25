// When running in Docker, this is the entrypoint.
// Secrets come via env vars, trigger info via MAGICALLY_TRIGGER env.
// Output is JSON to stdout — the runtime captures it.

const { execSync } = require('child_process');
const path = require('path');

// Detect if we're running in container (no ctx) or in-process (has ctx)
if (require.main === module) {
  // Container mode: run Python directly, secrets are already in env
  const output = execSync('python /agent/greet.py', { encoding: 'utf-8' });
  process.stdout.write(output);
} else {
  // In-process mode: export function for the runtime to call
  module.exports = async function greet(ctx) {
    ctx.log.info('Running greet.py');

    const output = execSync('python greet.py', {
      cwd: ctx.agentDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        GREETING_NAME: ctx.secrets.GREETING_NAME || 'World',
      },
    });

    const result = JSON.parse(output.trim());
    ctx.log.info('Greeting complete', result);
    ctx.emit('feed', { type: 'success', title: result.message });
    return result;
  };
}

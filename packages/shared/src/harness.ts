/**
 * Container agent harness script.
 * Injected into every container agent image at build time.
 *
 * Reads MAGICALLY_FUNCTION env var, requires the matching JS file,
 * calls the exported function with a minimal ctx built from env vars.
 */
export const HARNESS_SCRIPT = `
const fn_name = process.env.MAGICALLY_FUNCTION;
if (!fn_name) { console.error('MAGICALLY_FUNCTION not set'); process.exit(1); }

const path = require('path');
const mod = require(path.join('/agent/functions', fn_name + '.js'));
const handler = typeof mod === 'function' ? mod : mod.default || mod[fn_name] || mod;

if (typeof handler !== 'function') {
  console.error('No callable export found in functions/' + fn_name + '.js');
  process.exit(1);
}

const trigger = JSON.parse(process.env.MAGICALLY_TRIGGER || '{}');
const secrets = {};
for (const [k, v] of Object.entries(process.env)) {
  if (!k.startsWith('MAGICALLY_')) secrets[k] = v;
}

const logs = [];
const ctx = {
  agentId: process.env.MAGICALLY_AGENT_ID || '',
  agentDir: '/agent',
  trigger,
  config: {},
  secrets,
  log: {
    info: (msg, data) => { const entry = { level: 'info', message: msg, data }; logs.push(entry); console.log(JSON.stringify(entry)); },
    warn: (msg, data) => { const entry = { level: 'warn', message: msg, data }; logs.push(entry); console.warn(JSON.stringify(entry)); },
    error: (msg, data) => { const entry = { level: 'error', message: msg, data }; logs.push(entry); console.error(JSON.stringify(entry)); },
  },
  emit: (event, data) => { console.log(JSON.stringify({ _event: event, ...data })); },
  llm: {
    ask: async () => { throw new Error('LLM not available in container mode'); },
    askWithSystem: async () => { throw new Error('LLM not available in container mode'); },
  },
};

handler(ctx, trigger.payload)
  .then(result => {
    if (result !== undefined) console.log(JSON.stringify({ _result: result }));
    process.exit(0);
  })
  .catch(err => {
    console.error(JSON.stringify({ _error: err.message, stack: err.stack }));
    process.exit(1);
  });
`.trim();

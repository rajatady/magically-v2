/**
 * Worker script for running agent functions in a separate thread.
 * Receives: { agentDir, functionName, functionPath, agentId, secrets, payload }
 * Sends back: { type: 'result', data } | { type: 'error', message } | { type: 'emit', event, data } | { type: 'log', level, message, data }
 */
const { parentPort, workerData } = require('worker_threads');
const { join } = require('path');

const { agentDir, functionName, functionPath, agentId, secrets, payload } = workerData;

// Build context — emit and log send messages to parent
const ctx = {
  agentId,
  agentDir,
  trigger: { type: 'manual', payload },
  config: {},
  secrets,
  log: {
    info(message, data) { parentPort.postMessage({ type: 'log', level: 'info', message, data }); },
    warn(message, data) { parentPort.postMessage({ type: 'log', level: 'warn', message, data }); },
    error(message, data) { parentPort.postMessage({ type: 'log', level: 'error', message, data }); },
  },
  emit(event, data) { parentPort.postMessage({ type: 'emit', event, data }); },
  llm: {
    ask() { throw new Error('LLM not available in local run mode'); },
    askWithSystem() { throw new Error('LLM not available in local run mode'); },
  },
};

// Load and run
async function run() {
  const mod = require(functionPath);
  const handler = typeof mod === 'function' ? mod
    : typeof mod.default === 'function' ? mod.default
    : typeof mod[functionName] === 'function' ? mod[functionName]
    : null;

  if (!handler) {
    throw new Error(`${functionPath} does not export a callable function`);
  }

  return handler(ctx, payload);
}

run()
  .then((result) => { parentPort.postMessage({ type: 'result', data: result }); })
  .catch((err) => { parentPort.postMessage({ type: 'error', message: err.message || String(err) }); });

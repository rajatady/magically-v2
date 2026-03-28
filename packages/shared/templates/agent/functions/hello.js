module.exports = async function hello(ctx) {
  ctx.log.info('Hello from {{agentName}}!');

  return {
    message: 'Hello, world!',
    agent: '{{agentName}}',
    timestamp: Date.now(),
  };
};

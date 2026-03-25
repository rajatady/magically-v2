const { execSync } = require('child_process');

module.exports = async function fetchInsights(ctx) {
  ctx.log.info('Fetching Instagram insights');

  try {
    const output = execSync('python insights.py', {
      cwd: ctx.agentDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        IG_CT_ACCESS_TOKEN: ctx.secrets.IG_CT_ACCESS_TOKEN,
        IG_CT_ACCOUNT_ID: ctx.secrets.IG_CT_ACCOUNT_ID,
      },
    });

    ctx.log.info('Insights saved');
    ctx.emit('feed', { type: 'success', title: 'Analytics snapshot saved' });

    return { output };
  } catch (err) {
    ctx.log.error('Failed to fetch insights', { error: err.message });
    ctx.emit('feed', { type: 'error', title: 'Insights fetch failed', body: err.message });
    throw err;
  }
};

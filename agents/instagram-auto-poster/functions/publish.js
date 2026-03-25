const { execSync } = require('child_process');

module.exports = async function publish(ctx, params) {
  const contentPath = params?.contentPath;
  if (!contentPath) throw new Error('contentPath is required');

  ctx.log.info('Publishing carousel', { contentPath });

  try {
    const output = execSync(`python publish_carousel.py ${contentPath}`, {
      cwd: ctx.agentDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        IG_CT_ACCESS_TOKEN: ctx.secrets.IG_CT_ACCESS_TOKEN,
        IG_CT_ACCOUNT_ID: ctx.secrets.IG_CT_ACCOUNT_ID,
        BLOB_READ_WRITE_TOKEN: ctx.secrets.BLOB_READ_WRITE_TOKEN,
      },
    });

    ctx.log.info('Published successfully');
    ctx.emit('feed', { type: 'success', title: `Published: ${contentPath}` });

    return { output };
  } catch (err) {
    ctx.log.error('Publish failed', { error: err.message });
    ctx.emit('feed', { type: 'error', title: 'Publish failed', body: err.message });
    throw err;
  }
};

const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

module.exports = async function growthCycle(ctx, params) {
  const cwd = ctx.agentDir;
  const count = params?.count ?? 4;

  // Phase 1: Analyze
  ctx.log.info('Starting growth cycle', { count });

  const insights = execSync('python insights.py --no-save', { cwd, encoding: 'utf-8' });
  ctx.log.info('Fetched insights');

  const history = readFileSync(path.join(cwd, 'posts.tsv'), 'utf-8');
  const strategy = readFileSync(path.join(cwd, 'CONTENT_STRATEGY.md'), 'utf-8');

  // Phase 2: Plan
  // For now, this is deterministic. When ctx.llm is available,
  // this is where we'd ask the LLM to pick topics based on
  // insights + history + strategy.
  ctx.log.info('Analysis complete. LLM planning not yet wired — manual topic selection required.');

  ctx.emit('feed', {
    type: 'info',
    title: 'Growth cycle: analysis complete',
    body: `Analyzed ${history.split('\n').length - 1} posts. Ready for topic selection.`,
  });

  // Phase 3-4: Create + Render + Publish
  // These will be triggered individually via the createPost and publish functions
  // once the LLM planning step is wired.

  // Phase 5: Track
  try {
    execSync('python insights.py', { cwd, encoding: 'utf-8' });
    ctx.log.info('Saved analytics snapshot');
  } catch (err) {
    ctx.log.warn('Failed to save analytics snapshot', { error: err.message });
  }

  return {
    phase: 'analysis',
    postsAnalyzed: history.split('\n').length - 1,
    message: 'Analysis complete. LLM-driven topic selection coming next.',
  };
};

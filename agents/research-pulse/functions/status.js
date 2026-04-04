const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const RESEARCH_DIR = '/Users/kumardivyarajat/WebstormProjects/job-search/context';

function loadResearchContext() {
  const interests = loadFile(join(RESEARCH_DIR, 'research-interests.md'));
  const profile = loadFile(join(RESEARCH_DIR, 'kumar-profile.md'));

  // Parse key facts from research-interests.md
  const experiments = (interests.match(/(\d+)\+? experiments/i) || [])[1] || '30';
  const blogPosts = (interests.match(/(\d+) blog posts/i) || [])[1] || '2';
  const startDate = 'Nov 2025';

  // Parse research areas
  const areas = [];
  if (interests.includes('Neural Genome')) areas.push({ name: 'Neural Genome', status: 'active', color: '#8b5cf6' });
  if (interests.includes('spatial intelligence')) areas.push({ name: 'Spatial Intelligence', status: 'exploring', color: '#3b82f6' });
  if (interests.includes('interpretability')) areas.push({ name: 'Interpretability', status: 'connected', color: '#22c55e' });

  // Parse strengths/weaknesses
  const strengths = [];
  const gaps = [];
  if (interests.includes('Strong research taste')) strengths.push('Research taste');
  if (interests.includes('Synthesis ability')) strengths.push('Cross-domain synthesis');
  if (interests.includes('Implementation gap')) gaps.push('PyTorch fluency');
  if (interests.includes('No institutional')) gaps.push('No institutional affiliation');

  // Timeline
  const now = new Date();
  const start = new Date('2025-11-01');
  const monthsIn = Math.round((now.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000));

  return { experiments, blogPosts, startDate, monthsIn, areas, strengths, gaps };
}

function loadFile(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf-8') : '';
  } catch {
    return '';
  }
}

function buildWidget(data) {
  const { experiments, blogPosts, monthsIn, areas, strengths, gaps } = data;

  const areaRows = areas.map(a => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:6px;height:6px;border-radius:50%;background:${a.color}"></div>
        <span style="font-size:12px;color:#d4d4d8">${a.name}</span>
      </div>
      <span style="font-size:10px;color:${a.color}">${a.status}</span>
    </div>
  `).join('');

  return `
<div style="padding:20px;background:#0f0f14;color:#f4f4f5;border-radius:16px;font-family:'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column;gap:12px">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">🔬</span>
      <span style="font-size:14px;font-weight:600;color:#e4e4e7">Research</span>
    </div>
    <span style="font-size:11px;color:#71717a">${monthsIn} months in</span>
  </div>

  <div style="display:flex;gap:16px">
    <div style="text-align:center">
      <div style="font-size:28px;font-weight:300;color:#8b5cf6">${experiments}+</div>
      <div style="font-size:10px;color:#71717a">experiments</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:28px;font-weight:300;color:#8b5cf6">${blogPosts}</div>
      <div style="font-size:10px;color:#71717a">published</div>
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#71717a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Tracks</div>
    ${areaRows}
  </div>

  <div style="border-top:1px solid #1e1e2a;padding-top:8px;display:flex;gap:12px">
    <div style="flex:1">
      <div style="font-size:10px;color:#22c55e;margin-bottom:3px">Strengths</div>
      ${strengths.map(s => `<div style="font-size:11px;color:#a1a1aa">+ ${s}</div>`).join('')}
    </div>
    <div style="flex:1">
      <div style="font-size:10px;color:#f59e0b;margin-bottom:3px">Gaps</div>
      ${gaps.map(g => `<div style="font-size:11px;color:#a1a1aa">- ${g}</div>`).join('')}
    </div>
  </div>
</div>`.trim();
}

module.exports = async function status(ctx) {
  const data = loadResearchContext();

  ctx.log.info('Research pulse', {
    experiments: data.experiments,
    blogPosts: data.blogPosts,
    monthsIn: data.monthsIn,
    areas: data.areas.length,
  });

  ctx.emit('feed', {
    type: 'info',
    title: `Research: ${data.experiments}+ experiments, ${data.blogPosts} published, ${data.monthsIn} months in`,
  });

  ctx.emit('widget', {
    size: 'small',
    html: buildWidget(data),
  });

  return data;
};

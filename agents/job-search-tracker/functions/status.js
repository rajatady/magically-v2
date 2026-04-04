const { readFileSync } = require('fs');
const { join } = require('path');

const JOB_SEARCH_DIR = '/Users/kumardivyarajat/WebstormProjects/job-search';

function parseJobsTsv() {
  const raw = readFileSync(join(JOB_SEARCH_DIR, 'jobs.tsv'), 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split('\t');

  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return row;
  });
}

function categorize(jobs) {
  const applied = jobs.filter(j => j.status && j.status.startsWith('Applied'));
  const notApplied = jobs.filter(j => j.status === 'Not applied');
  const dead = jobs.filter(j => j.status && j.status.includes('DEAD'));

  // Sort not-applied by expected salary descending
  notApplied.sort((a, b) => {
    const salA = parseInt((a.expected_salary || '0').replace(/[^0-9]/g, '')) || 0;
    const salB = parseInt((b.expected_salary || '0').replace(/[^0-9]/g, '')) || 0;
    return salB - salA;
  });

  return { applied, notApplied, dead, total: jobs.length };
}

function buildWidget(data) {
  const { applied, notApplied, dead, total } = data;

  const appliedRows = applied.map(j => {
    const status = j.status.replace('Applied ', '').trim();
    const comments = j.comments || '';
    const shortComment = comments.length > 60 ? comments.slice(0, 57) + '...' : comments;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1e1e2a">
        <div>
          <span style="font-size:13px;color:#e4e4e7;font-weight:500">${j.company}</span>
          <span style="font-size:11px;color:#71717a;margin-left:6px">${j.role}</span>
        </div>
        <span style="font-size:10px;color:#f59e0b">${status}</span>
      </div>`;
  }).join('');

  // Top 5 not-applied by salary
  const topPipeline = notApplied.slice(0, 5).map(j => {
    const salary = j.expected_salary || '?';
    const visa = j.visa && j.visa.includes('Yes') ? '✓' : '?';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
        <div>
          <span style="font-size:12px;color:#d4d4d8">${j.company}</span>
          <span style="font-size:10px;color:#71717a;margin-left:4px">${j.role.slice(0, 30)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:10px;color:#6366f1">${salary}</span>
          <span style="font-size:10px;color:${visa === '✓' ? '#22c55e' : '#71717a'}">H1B ${visa}</span>
        </div>
      </div>`;
  }).join('');

  // Donut-style stats
  const appliedPct = Math.round((applied.length / total) * 100);
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const appliedArc = (appliedPct / 100) * circ;

  return `
<div style="padding:20px;background:#0f0f14;color:#f4f4f5;border-radius:16px;font-family:'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">🎯</span>
      <span style="font-size:14px;font-weight:600;color:#e4e4e7">Job Search</span>
    </div>
    <span style="font-size:11px;color:#71717a">${total} roles tracked</span>
  </div>

  <div style="display:flex;gap:20px;align-items:center">
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r="${radius}" fill="none" stroke="#1e1e2a" stroke-width="6"/>
      <circle cx="35" cy="35" r="${radius}" fill="none" stroke="#3b82f6" stroke-width="6"
        stroke-dasharray="${appliedArc} ${circ - appliedArc}"
        stroke-dashoffset="${circ * 0.25}" stroke-linecap="round"/>
      <text x="35" y="38" text-anchor="middle" fill="#f4f4f5" font-size="14" font-weight="500">${applied.length}</text>
    </svg>
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block"></span>
        <span style="font-size:12px;color:#a1a1aa">Applied: ${applied.length}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block"></span>
        <span style="font-size:12px;color:#a1a1aa">Pipeline: ${notApplied.length}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block"></span>
        <span style="font-size:12px;color:#a1a1aa">Dead: ${dead.length}</span>
      </div>
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#71717a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Active Applications</div>
    ${appliedRows || '<div style="font-size:12px;color:#71717a;padding:6px 0">None yet</div>'}
  </div>

  <div>
    <div style="font-size:10px;color:#71717a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Top Pipeline · by salary</div>
    ${topPipeline}
  </div>
</div>`.trim();
}

module.exports = async function status(ctx) {
  ctx.log.info('Parsing job search data');

  const jobs = parseJobsTsv();
  const data = categorize(jobs);

  ctx.log.info('Job search status', {
    total: data.total,
    applied: data.applied.length,
    pipeline: data.notApplied.length,
    dead: data.dead.length,
  });

  const appliedNames = data.applied.map(j => `${j.company} (${j.role})`).join(', ');
  ctx.emit('feed', {
    type: 'info',
    title: `Job search: ${data.applied.length} applied, ${data.notApplied.length} in pipeline`,
    body: appliedNames || 'No applications yet',
  });

  ctx.emit('widget', {
    size: 'medium',
    html: buildWidget(data),
  });

  return {
    total: data.total,
    applied: data.applied.length,
    pipeline: data.notApplied.length,
    dead: data.dead.length,
    appliedCompanies: data.applied.map(j => j.company),
  };
};

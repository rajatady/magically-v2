// Runway calculation based on known data:
// - ~3 months runway as of late March 2026
// - Start date: March 25, 2026 (approximate)
// - End date: ~June 25, 2026

const RUNWAY_START = new Date('2026-03-25');
const RUNWAY_MONTHS = 3;
const RUNWAY_END = new Date('2026-06-25');

function calculateRunway() {
  const now = new Date();
  const totalMs = RUNWAY_END.getTime() - RUNWAY_START.getTime();
  const elapsedMs = now.getTime() - RUNWAY_START.getTime();
  const remainingMs = Math.max(0, RUNWAY_END.getTime() - now.getTime());

  const totalWeeks = Math.round(totalMs / (7 * 24 * 60 * 60 * 1000));
  const weeksLeft = Math.max(0, Math.round(remainingMs / (7 * 24 * 60 * 60 * 1000) * 10) / 10);
  const daysLeft = Math.max(0, Math.round(remainingMs / (24 * 60 * 60 * 1000)));
  const pctUsed = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  let urgency = 'normal';
  let urgencyColor = '#22c55e';
  if (weeksLeft <= 4) { urgency = 'critical'; urgencyColor = '#ef4444'; }
  else if (weeksLeft <= 8) { urgency = 'warning'; urgencyColor = '#f59e0b'; }

  return { weeksLeft, daysLeft, totalWeeks, pctUsed, urgency, urgencyColor };
}

function buildWidget(data) {
  const { weeksLeft, daysLeft, totalWeeks, pctUsed, urgency, urgencyColor } = data;

  // Progress bar — fills from left (used) to right (remaining)
  const barWidth = 240;
  const usedWidth = Math.round((pctUsed / 100) * barWidth);

  // Milestones
  const milestones = [
    { label: 'Tier 2 apps sent', week: 2, done: false },
    { label: 'First callbacks', week: 4, done: false },
    { label: 'Interviews', week: 6, done: false },
    { label: 'Offers', week: 10, done: false },
  ];

  const now = new Date();
  const elapsedWeeks = Math.round((now.getTime() - RUNWAY_START.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const milestoneRows = milestones.map(m => {
    const past = elapsedWeeks >= m.week;
    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0">
      <div style="width:6px;height:6px;border-radius:50%;background:${past ? '#71717a' : urgencyColor};flex-shrink:0"></div>
      <span style="font-size:11px;color:${past ? '#52525b' : '#a1a1aa'};${past ? 'text-decoration:line-through' : ''}">Wk ${m.week}: ${m.label}</span>
    </div>`;
  }).join('');

  const endDate = RUNWAY_END.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return `
<div style="padding:20px;background:#0f0f14;color:#f4f4f5;border-radius:16px;font-family:'DM Sans',system-ui,sans-serif;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">⏳</span>
      <span style="font-size:14px;font-weight:600;color:#e4e4e7">Runway</span>
    </div>
    <span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:${urgencyColor}20;color:${urgencyColor}">${urgency}</span>
  </div>

  <div style="display:flex;align-items:baseline;gap:8px">
    <span style="font-size:42px;font-weight:300;letter-spacing:-2px;color:${urgencyColor}">${weeksLeft}</span>
    <span style="font-size:14px;color:#71717a">weeks left</span>
    <span style="font-size:12px;color:#52525b;margin-left:auto">${daysLeft}d → ${endDate}</span>
  </div>

  <div>
    <svg width="${barWidth}" height="8" viewBox="0 0 ${barWidth} 8" style="display:block;border-radius:4px;overflow:hidden">
      <rect x="0" y="0" width="${barWidth}" height="8" fill="#1e1e2a"/>
      <rect x="0" y="0" width="${usedWidth}" height="8" fill="${urgencyColor}"/>
    </svg>
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <span style="font-size:10px;color:#52525b">${pctUsed}% elapsed</span>
      <span style="font-size:10px;color:#52525b">${100 - pctUsed}% remaining</span>
    </div>
  </div>

  <div style="border-top:1px solid #1e1e2a;padding-top:10px">
    <div style="font-size:10px;color:#71717a;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Milestones</div>
    ${milestoneRows}
  </div>
</div>`.trim();
}

module.exports = async function check(ctx) {
  const data = calculateRunway();

  ctx.log.info('Runway check', {
    weeksLeft: data.weeksLeft,
    daysLeft: data.daysLeft,
    urgency: data.urgency,
  });

  ctx.emit('feed', {
    type: data.urgency === 'critical' ? 'error' : data.urgency === 'warning' ? 'warning' : 'info',
    title: `Runway: ${data.weeksLeft} weeks remaining (${data.daysLeft} days)`,
  });

  ctx.emit('widget', {
    size: 'small',
    html: buildWidget(data),
  });

  return data;
};

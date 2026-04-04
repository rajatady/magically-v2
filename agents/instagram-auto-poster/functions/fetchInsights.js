const { execSync } = require('child_process');

function parseInsights(output) {
  const lines = output.split('\n');

  // Parse follower count
  const followersLine = lines.find(l => l.includes('Followers:'));
  const followers = followersLine ? parseInt(followersLine.match(/Followers:\s*([\d,]+)/)?.[1]?.replace(',', '') || '0') : 0;
  const posts = followersLine ? parseInt(followersLine.match(/Posts:\s*([\d,]+)/)?.[1]?.replace(',', '') || '0') : 0;

  // Parse post rows — lines with numbers and dates
  const postRows = [];
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+(CAR|REEL)\s+(\d{4}-\d{2}-\d{2})\s+/);
    if (match) {
      const parts = line.trim().split(/\s+/);
      const type = parts[1];
      const date = parts[2];
      // Find numeric columns after date
      const nums = [];
      for (let i = 3; i < parts.length; i++) {
        if (parts[i] === '—') { nums.push(0); continue; }
        const n = parseInt(parts[i].replace(',', ''));
        if (!isNaN(n)) nums.push(n);
        else break;
      }
      postRows.push({
        type,
        date,
        views: nums[0] || 0,
        reach: nums[1] || 0,
        likes: nums[2] || 0,
        saves: nums[3] || 0,
      });
    }
  }

  // Sort by date descending
  postRows.sort((a, b) => b.date.localeCompare(a.date));

  // Last 14 days of posts for the chart
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  const recentPosts = postRows.filter(p => new Date(p.date) >= fourteenDaysAgo);

  // Daily reach for chart
  const dailyReach = {};
  for (const p of recentPosts) {
    dailyReach[p.date] = (dailyReach[p.date] || 0) + p.reach;
  }

  // Top post by engagement (likes + saves)
  const topPost = [...postRows].sort((a, b) => (b.likes + b.saves) - (a.likes + a.saves))[0];

  // Totals
  const totalLikes = postRows.reduce((s, p) => s + p.likes, 0);
  const totalSaves = postRows.reduce((s, p) => s + p.saves, 0);
  const reelCount = postRows.filter(p => p.type === 'REEL').length;
  const carouselCount = postRows.filter(p => p.type === 'CAR').length;

  return { followers, posts, postRows, recentPosts, dailyReach, topPost, totalLikes, totalSaves, reelCount, carouselCount };
}

function buildSparkline(dailyReach, width, height) {
  const dates = Object.keys(dailyReach).sort();
  if (dates.length === 0) return '';
  const values = dates.map(d => dailyReach[d]);
  const max = Math.max(...values, 1);
  const step = width / Math.max(dates.length - 1, 1);

  const points = values.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
  const fillPoints = `0,${height} ${points} ${(values.length - 1) * step},${height}`;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${fillPoints}" fill="url(#rg)"/>
      <polyline points="${points}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function buildTypeBar(reelCount, carouselCount, width) {
  const total = reelCount + carouselCount || 1;
  const reelW = Math.round((reelCount / total) * width);
  return `
    <svg width="${width}" height="8" viewBox="0 0 ${width} 8" style="display:block;border-radius:4px;overflow:hidden">
      <rect x="0" y="0" width="${reelW}" height="8" fill="#f59e0b" rx="0"/>
      <rect x="${reelW}" y="0" width="${width - reelW}" height="8" fill="#6366f1" rx="0"/>
    </svg>
  `;
}

function buildWidget(data) {
  const { followers, posts, dailyReach, topPost, totalLikes, totalSaves, reelCount, carouselCount } = data;
  const sparkline = buildSparkline(dailyReach, 280, 60);
  const typeBar = buildTypeBar(reelCount, carouselCount, 280);
  const topCaption = topPost ? topPost.type + ' · ' + topPost.date + ' · ' + topPost.likes + '♥ ' + topPost.saves + '⊡' : 'No posts';

  return `
<div style="padding:20px;background:#0f0f14;color:#f4f4f5;border-radius:16px;font-family:'DM Sans',system-ui,sans-serif;height:100%;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📸</span>
      <span style="font-size:14px;font-weight:600;color:#e4e4e7">@coding_tips_pro</span>
    </div>
    <span style="font-size:11px;color:#71717a">${posts} posts</span>
  </div>

  <div style="display:flex;gap:16px">
    <div>
      <div style="font-size:36px;font-weight:300;letter-spacing:-1px;color:#fff">${followers.toLocaleString()}</div>
      <div style="font-size:11px;color:#a1a1aa;margin-top:2px">followers</div>
    </div>
    <div style="border-left:1px solid #27272a;padding-left:16px;display:flex;flex-direction:column;justify-content:center;gap:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px;font-weight:500;color:#f59e0b">${totalLikes}</span>
        <span style="font-size:11px;color:#a1a1aa">likes</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:18px;font-weight:500;color:#8b5cf6">${totalSaves}</span>
        <span style="font-size:11px;color:#a1a1aa">saves</span>
      </div>
    </div>
  </div>

  <div>
    <div style="font-size:10px;color:#71717a;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Reach · 14 days</div>
    ${sparkline}
  </div>

  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:10px;color:#f59e0b">● Reels ${reelCount}</span>
      <span style="font-size:10px;color:#6366f1">● Carousels ${carouselCount}</span>
    </div>
    ${typeBar}
  </div>

  <div style="border-top:1px solid #1e1e2a;padding-top:10px">
    <div style="font-size:10px;color:#71717a;margin-bottom:3px">TOP POST</div>
    <div style="font-size:12px;color:#d4d4d8;line-height:1.3">${topCaption}</div>
  </div>
</div>
  `.trim();
}

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

    const data = parseInsights(output);

    ctx.log.info('Insights parsed', { followers: data.followers, posts: data.posts, likes: data.totalLikes, saves: data.totalSaves });
    ctx.emit('feed', { type: 'success', title: `Analytics: ${data.followers} followers, ${data.totalLikes} likes, ${data.totalSaves} saves` });

    ctx.emit('widget', {
      size: 'medium',
      html: buildWidget(data),
    });

    return { followers: data.followers, posts: data.posts, totalLikes: data.totalLikes, totalSaves: data.totalSaves };
  } catch (err) {
    ctx.log.error('Failed to fetch insights', { error: err.message });
    ctx.emit('feed', { type: 'error', title: 'Insights fetch failed', body: err.message });
    throw err;
  }
};

// Export for testing
module.exports.parseInsights = parseInsights;
module.exports.buildWidget = buildWidget;

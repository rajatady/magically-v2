// Export React posts data as JSON for render_v2
// Run with: node content/v2/export_posts.js

const fs = require('fs');
const path = require('path');

// Read the posts.ts file and extract the data
const postsFile = fs.readFileSync(
  path.join(__dirname, '../../grid_preview/src/data/posts.ts'), 'utf8'
);

// Replace TypeScript-specific syntax for eval
let jsCode = postsFile
  .replace(/export type SlideData[\s\S]*?};/m, '')
  .replace(/export type Post[\s\S]*?};/m, '')
  .replace(/export const posts/m, 'const posts')
  .replace(/as const/g, '')
  // Replace template literal spans with escaped versions for JSON
  ;

// Write a simplified version — just eval it
const evalCode = `
const DARK = '#0a0a0a';
const LIGHT = '#f5f5f7';
const CREAM = '#F7F3EA';
${jsCode.substring(jsCode.indexOf('const posts'))}
module.exports = posts;
`;

// Write temp file and require it
const tmpFile = path.join(__dirname, '_tmp_posts.js');
fs.writeFileSync(tmpFile, evalCode);

try {
  const posts = require(tmpFile);
  const output = JSON.stringify(posts, null, 2);
  const outFile = path.join(__dirname, 'all_posts.json');
  fs.writeFileSync(outFile, output);
  console.log(`Exported ${posts.length} posts to ${outFile}`);
} catch (e) {
  console.error('Error:', e.message);
  // Fallback: just output the raw TS for manual conversion
  console.log('Writing raw posts data...');
} finally {
  fs.unlinkSync(tmpFile);
}

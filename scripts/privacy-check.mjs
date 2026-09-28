// Heuristic disclosure guard. Reports locations/categories, never secret values.
import { execFileSync } from 'node:child_process';
const stagedOnly = process.argv.includes('--staged');
if (process.argv.slice(2).some(arg => arg !== '--staged')) throw new Error('Usage: node scripts/privacy-check.mjs [--staged]');
const git = (...args) => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 });
const findings = new Set();
const add = (path, category) => findings.add(`${path}: ${category}`);
const excludedPath = /^(?:artifacts|\.local|\.agents|\.codex|node_modules|dist|\.next|\.vinext|\.wrangler)\//;
const checks = [
  ['absolute home path', /\/(?:home|Users)\/[^\s/"'`<>]+\//g],
  ['Windows user path', /[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\s\\/]+/g],
  ['private network hostname', /\b[a-z0-9.-]+\.(?:ts\.net|internal|local)\b/gi],
  ['private network address', /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2})\b/g],
  ['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  ['service token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[A-Z0-9]{16})\b/g],
  ['Cloudflare token', /\bcf(?:ut|at)_[A-Za-z0-9_-]{20,}\b/g],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{30,}\b/g],
  ['assistant session link', /https?:\/\/(?:claude\.ai\/code\/session[^\s<>]*|(?:chatgpt\.com|chat\.openai\.com)\/(?:c|share)\/[^\s<>]+)/gi],
  ['hosting identity', /["'](?:account_id|projectId|orgId)["']\s*:\s*["'](?!0{8}-)[A-Za-z0-9_-]{16,}["']/g],
  ['credential in URL', /https?:\/\/[^\s/@:]+:[^\s/@]+@/g],
  ['literal credential assignment', /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|client[_-]?secret)\s*[=:]\s*["'][A-Za-z0-9_./+\-=]{16,}["']/gi],
];
function checkBlob(path, bytes) {
  if (excludedPath.test(path) || path === '.openai/hosting.json' || /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.netrc)$/.test(path) || /\.(?:key|pem|p12|pfx|keystore|bundle|service)$/.test(path)) add(path, 'local or credential file must not be tracked');
  // PNG text and EXIF chunks can disclose paths, author names and capture details.
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8);
      if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(kind)) add(path, `review PNG ${kind} metadata`);
      offset += length + 12;
    }
    return;
  }
  if (bytes.includes(0)) return;
  const text = bytes.toString('utf8');
  for (const [label, pattern] of checks) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) add(path, label);
  }
  const emails = text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
  for (const [email] of emails) if (!/@(?:example\.(?:com|org|net|invalid)|users\.noreply\.github\.com)$/i.test(email)) add(path, 'review email address');
  if (/"project_id"\s*:\s*"[^"\s]+"/.test(text)) add(path, 'deployment project identity');
}
const blobs = new Map();
for (const record of git('ls-files', '--stage', '-z').toString().split('\0').filter(Boolean)) {
  const tab = record.indexOf('\t'), [mode, id, stage] = record.slice(0, tab).split(' '), path = record.slice(tab + 1);
  if (stage !== '0') { add(path, 'unmerged index'); continue; }
  if (mode === '160000') { add(path, 'review submodule content separately'); continue; }
  if (!blobs.has(id)) blobs.set(id, new Set()); blobs.get(id).add(path);
}
let commits = [];
if (!stagedOnly) {
  commits = git('rev-list', '--all').toString().trim().split('\n').filter(Boolean);
  for (const commit of commits) {
    const raw = git('cat-file', 'commit', commit).toString();
    for (const role of ['author', 'committer']) {
      const identity = raw.split('\n').find(line => line.startsWith(`${role} `));
      const publicIdentity = new RegExp(`^${role} .+ <(?:contributors@example\\.invalid|[A-Za-z0-9+_.-]+@users\\.noreply\\.github\\.com|noreply@github\\.com)> `);
      if (!identity || !publicIdentity.test(identity)) add(`commit ${commit.slice(0, 12)}`, `review ${role} identity`);
    }
    checkBlob(`commit ${commit.slice(0, 12)} message`, Buffer.from(raw.split('\n\n').slice(1).join('\n\n')));
    for (const record of git('ls-tree', '-r', '-z', commit).toString().split('\0').filter(Boolean)) {
      const tab = record.indexOf('\t'), [, type, id] = record.slice(0, tab).split(' '), path = record.slice(tab + 1);
      if (type !== 'blob') continue;
      if (!blobs.has(id)) blobs.set(id, new Set()); blobs.get(id).add(path);
    }
  }
}
for (const [id, paths] of blobs) {
  const bytes = git('cat-file', 'blob', id);
  for (const path of paths) checkBlob(path, bytes);
}
if (findings.size) {
  console.error([...findings].sort().join('\n'));
  console.error(`Privacy check found ${findings.size} review item(s); matched values are withheld.`);
  process.exitCode = 1;
} else console.log(`Privacy check passed: ${blobs.size} distinct blobs, ${commits.length} reachable commits${stagedOnly ? ' (staged content only)' : ''}.`);

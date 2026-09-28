import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
const checker = fileURLToPath(new URL('../scripts/privacy-check.mjs', import.meta.url));
const identity = { ...process.env, GIT_AUTHOR_NAME: 'Shader Seedbank Contributors', GIT_COMMITTER_NAME: 'Shader Seedbank Contributors', GIT_AUTHOR_EMAIL: 'contributors@example.invalid', GIT_COMMITTER_EMAIL: 'contributors@example.invalid' };
function fixture(run: (directory: string, git: (...args: string[]) => void) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'seedbank-privacy-'));
  const git = (...args: string[]) => { execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false', ...args], { cwd: directory, env: identity, stdio: 'pipe' }); };
  try { git('init', '--quiet'); run(directory, git); } finally { rmSync(directory, { recursive: true, force: true }); }
}
const scan = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [checker, ...args], { cwd, encoding: 'utf8' });

test('privacy guard allows ordinary public setup and project commit identities', () => fixture((directory, git) => {
  writeFileSync(join(directory, 'README.md'), 'Run on http://127.0.0.1:5187. Read https://threejs.org/docs/.');
  git('add', '.'); git('commit', '--quiet', '-m', 'Initial source');
  assert.equal(scan(directory).status, 0);
}));

test('privacy guard allows GitHub noreply attribution but flags personal email identities', () => fixture((directory, git) => {
  writeFileSync(join(directory, 'README.md'), 'Public project.');
  git('add', '.');
  git('commit', '--quiet', '--author', 'Example <123+example@users.noreply.github.com>', '-m', 'Public attribution');
  assert.equal(scan(directory).status, 0);
  const personalEmail = ['person', 'private.invalid'].join('@');
  git('commit', '--quiet', '--allow-empty', '--author', `Example <${personalEmail}>`, '-m', 'Needs review');
  const result = scan(directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /review author identity/);
  assert.ok(!result.stderr.includes(personalEmail));
}));

test('privacy guard detects a removed secret in reachable history without printing it', () => fixture((directory, git) => {
  const secret = ['gh', 'p_', 'a'.repeat(36)].join('');
  writeFileSync(join(directory, 'config.txt'), `credential: ${secret}`);
  git('add', '.'); git('commit', '--quiet', '-m', 'Old source');
  writeFileSync(join(directory, 'config.txt'), 'No credential.');
  git('add', '.'); git('commit', '--quiet', '-m', 'Remove credential');
  assert.equal(scan(directory, '--staged').status, 0);
  const result = scan(directory);
  assert.equal(result.status, 1); assert.match(result.stderr, /GitHub token/);
  assert.ok(!result.stderr.includes(secret));
}));

test('privacy guard rejects private paths, addresses and tracked local configuration', () => fixture((directory, git) => {
  const home = ['/', 'home', '/', 'fixture-user', '/', 'project'].join('');
  const host = ['machine', 'private', 'ts', 'net'].join('.');
  writeFileSync(join(directory, 'notes.txt'), `${home}\nhttps://${host}/`);
  writeFileSync(join(directory, '.env'), 'EXAMPLE=placeholder');
  git('add', '.');
  const result = scan(directory, '--staged');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /absolute home path/); assert.match(result.stderr, /private network hostname/);
  assert.match(result.stderr, /local or credential file/); assert.ok(!result.stderr.includes(home));
}));

test('privacy guard detects Cloudflare credentials and assistant session links without printing them', () => fixture((directory, git) => {
  const token = ['cf', 'ut_', 'a'.repeat(40)].join('');
  const session = ['https://claude.ai/', 'code/', 'session_', 'private-fixture'].join('');
  writeFileSync(join(directory, 'notes.txt'), `${token}\n${session}`);
  writeFileSync(join(directory, '.dev.vars'), 'EXAMPLE=placeholder');
  git('add', '.');
  const result = scan(directory, '--staged');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cloudflare token/);
  assert.match(result.stderr, /assistant session link/);
  assert.match(result.stderr, /local or credential file/);
  assert.ok(!result.stderr.includes(token));
  assert.ok(!result.stderr.includes(session));
}));

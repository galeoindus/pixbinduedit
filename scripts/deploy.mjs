#!/usr/bin/env node
/**
 * Pixel Studio Edit — deploy to Cloudflare Pages.
 *
 * A Pages project has to exist before anything can be published to it, and a
 * fresh Cloudflare account has none: `wrangler pages deploy` answers
 * "Project not found" and stops. That message is not a broken repository, it
 * is a missing project — the one thing this script takes care of.
 *
 *   1. read the project name from wrangler.toml (one source of truth);
 *   2. create the project when the account has none, and treat "already
 *      exists" as success;
 *   3. upload the site.
 *
 *   node scripts/deploy.mjs
 *
 * Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment, or
 * a `npx wrangler login` session.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
const name = (/^\s*name\s*=\s*"([^"]+)"/m.exec(config) || [])[1];
const branch = (/^\s*production_branch\s*=\s*"([^"]+)"/m.exec(config) || [])[1] || 'main';

if (!name) {
  console.error('wrangler.toml has no name = "…" line; refusing to guess a project name.');
  process.exit(1);
}

const wrangler = (args, { allowFail = false } = {}) => {
  try {
    return execFileSync('npx', ['--yes', 'wrangler', ...args], { cwd: ROOT, encoding: 'utf8' });
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (allowFail) return out;
    console.error(out.trim());
    process.exit(1);
  }
};

console.log(`Pages project: ${name} · production branch: ${branch}`);

const created = wrangler(['pages', 'project', 'create', name, '--production-branch', branch], { allowFail: true });
if (/already exists/i.test(created)) console.log(`Project ${name} already exists — reusing it.`);
else if (/created successfully/i.test(created)) console.log(`Created project ${name}.`);
else if (/error/i.test(created)) console.log(created.trim().split('\n').slice(-3).join('\n'));

execFileSync('npx', ['--yes', 'wrangler', 'pages', 'deploy', '.',
  `--project-name=${name}`, `--branch=${branch}`, '--commit-dirty=true'], { cwd: ROOT, stdio: 'inherit' });

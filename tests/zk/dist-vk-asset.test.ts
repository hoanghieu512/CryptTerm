import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Feature: zk-core, Requirement 7.7 (dist_vk_asset), fixture cases only. The script runs on
// folders made here. The run on a real build output is a group 4 task (the e2e build).
const repo = (path: string): string => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const SCRIPT = repo('scripts/check-dist-vk');
const REAL_VK = new Uint8Array(readFileSync(repo('src/zk/artifacts/ledger_audit.vk')));

/** The script's exit status and its two output streams. */
function runScript(dir: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A build-output-like folder: `assets/` with the named files, each given as [name, bytes]. */
function fixture(files: readonly (readonly [string, Uint8Array | string])[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'cryptterm-dist-'));
  mkdirSync(join(dir, 'assets'));
  for (const [name, content] of files) {
    writeFileSync(join(dir, 'assets', name), content);
  }
  return dir;
}

const withBit = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes, (b, i) => (i === 7 ? b ^ 1 : b));

describe('dist_vk_asset', () => {
  it('dist_vk_asset: one hashed .vk file with the right hash passes', () => {
    const run = runScript(fixture([['ledger_audit-5JPH1jzG.vk', REAL_VK], ['index-abc.js', 'export {};']]));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('check-dist-vk: PASS');
  });

  it('dist_vk_asset: an unhashed name also passes', () => {
    expect(runScript(fixture([['ledger_audit.vk', REAL_VK]])).status).toBe(0);
  });

  it('dist_vk_asset: no .vk file fails', () => {
    const run = runScript(fixture([['index-abc.js', 'export {};']]));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('check-dist-vk:');
  });
});

describe('dist_vk_asset failures', () => {
  it('dist_vk_asset: two .vk files fail', () => {
    const two = fixture([['ledger_audit-a1.vk', REAL_VK], ['ledger_audit-b2.vk', REAL_VK]]);
    expect(runScript(two).status).toBe(1);
  });

  it('dist_vk_asset: a hash that differs from VK_HASH fails', () => {
    const run = runScript(fixture([['ledger_audit-a1.vk', withBit(REAL_VK)]]));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('check-dist-vk:');
  });
});

describe('dist_vk_asset inlining and folders', () => {
  it('dist_vk_asset: key bytes inlined into a .js file fail', () => {
    const head = Buffer.from(REAL_VK.slice(0, 48)).toString('base64');
    const run = runScript(fixture([['ledger_audit-a1.vk', REAL_VK], ['index-abc.js', `const k = "${head}";`]]));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('check-dist-vk:');
  });

  it('dist_vk_asset: a folder that does not exist fails', () => {
    expect(runScript(join(tmpdir(), 'cryptterm-no-such-dist')).status).toBe(1);
  });
});

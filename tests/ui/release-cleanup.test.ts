import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../support/fs-walk';

// Tests spike_files_removed, spike_word_absent and dist_no_spike_files (release Requirement 1.1,
// 1.2, 1.4, examples). Each runs the command of the requirement and checks its output. The dist
// check needs a build, so it runs only when CHECK_DIST=1.

const KEPT_SPIKE_PREFIXES: readonly string[] = ['docs/spike-results.md', '.kiro/specs/zk-spike/'];
const WORD_SCOPE: readonly string[] = ['src', 'scripts', 'e2e', 'vite.config.ts', 'package.json'];

function run(command: string, args: readonly string[]): { readonly status: number | null; readonly stdout: string } {
  const result = spawnSync(command, [...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout };
}

describe('spike removal', () => {
  it('spike_files_removed: every tracked path with spike in it is a kept spike file', () => {
    const listed = run('git', ['ls-files']);
    expect(listed.status).toBe(0);
    const spikePaths = listed.stdout
      .split('\n')
      .filter((path) => path.length > 0 && path.toLowerCase().includes('spike'));
    const unexpected = spikePaths.filter((path) => !KEPT_SPIKE_PREFIXES.some((prefix) => path.startsWith(prefix)));
    expect(unexpected).toEqual([]);
    expect(spikePaths).toContain('docs/spike-results.md');
  });

  it('spike_word_absent: src, scripts, e2e, vite.config.ts and package.json never contain the word spike', () => {
    // grep exits 1 when nothing matches. Print file names only, so a failure never echoes file text.
    const found = run('grep', ['-rl', 'spike', ...WORD_SCOPE]);
    expect(found.status).toBe(1);
    expect(found.stdout).toBe('');
  });

  it.runIf(process.env['CHECK_DIST'] === '1')('dist_no_spike_files: dist holds no file with spike in its name', () => {
    const found = run('find', ['dist', '-iname', '*spike*']);
    expect(found.status).toBe(0);
    expect(found.stdout).toBe('');
  });
});

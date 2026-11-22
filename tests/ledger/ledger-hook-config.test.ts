import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Test ledger_hook_config (ledger-format Requirements 9.1, 9.2, example, one run).
//
// Kiro IDE 1.5.11. Hook file format, from https://kiro.dev/docs/hooks/ (looked up Nov 2026):
//   `.kiro/hooks/<id>.json` holding
//   { "version": "v1", "hooks": [ { "name", "trigger": "PostFileSave", "matcher": "<regex on the
//     file path>", "action": { "type": "command", "command": "..." } } ] }
// The design called the file `ledger-save.kiro.hook`. The file name is kept in one constant below
// and is created by task 3.4 after huynh approves `ledger-save.json`.
//
// Why the command has no exclusion flag: `vite.config.ts` lists `tests/zk/proof/**` in its
// `test.exclude`, so `npx vitest run tests/ledger tests/zk` already skips the slow proof tests.
// The last test checks that exclusion in the config.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HOOK_FILE_NAME = 'ledger-save.json';
const HOOK_FILE = join(REPO_ROOT, '.kiro', 'hooks', HOOK_FILE_NAME);
const VITE_CONFIG_FILE = join(REPO_ROOT, 'vite.config.ts');
const EXPECTED_COMMAND = 'npx vitest run tests/ledger tests/zk';

const MATCHING_PATHS: readonly string[] = ['src/ledger/parse.ts', 'src/ledger/trusted-keys.ts', 'src/zk/batch-root.ts', '/Users/dev/CryptTerm/src/ledger/parse.ts', '/Users/dev/CryptTerm/src/zk/batch-root.ts'];
const NON_MATCHING_PATHS: readonly string[] = ['src/ui/App.tsx', 'tests/ledger/x.test.ts', 'docs/spike-results.md', '/Users/dev/CryptTerm/src/ui/App.tsx', '/Users/dev/mysrc/ledger/x.ts', 'notsrc/zk/x.ts'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface SaveHook {
  readonly version: unknown;
  readonly trigger: unknown;
  readonly matcher: unknown;
  readonly actionType: unknown;
  readonly command: unknown;
}

/** Reads the hook file and returns the first hook whose trigger is PostFileSave. */
function readSaveHook(): SaveHook {
  const parsed: unknown = JSON.parse(readFileSync(HOOK_FILE, 'utf8'));
  if (!isRecord(parsed)) throw new Error('TEST HOOK FILE NOT AN OBJECT');
  const hooks = parsed['hooks'];
  if (!Array.isArray(hooks)) throw new Error('TEST HOOK FILE HAS NO hooks ARRAY');
  const found: unknown = hooks.find((hook: unknown) => isRecord(hook) && hook['trigger'] === 'PostFileSave');
  if (!isRecord(found)) throw new Error('TEST HOOK FILE HAS NO PostFileSave HOOK');
  const action = found['action'];
  if (!isRecord(action)) throw new Error('TEST HOOK HAS NO action');
  return {
    version: parsed['version'],
    trigger: found['trigger'],
    matcher: found['matcher'],
    actionType: action['type'],
    command: action['command'],
  };
}

describe('ledger_hook_config', () => {
  it('ledger_hook_config: .kiro/hooks/ledger-save.json is a v1 PostFileSave command hook that runs the ledger and zk tests', () => {
    const hook = readSaveHook();
    expect(hook.version).toBe('v1');
    expect(hook.trigger).toBe('PostFileSave');
    expect(hook.actionType).toBe('command');
    expect(hook.command).toBe(EXPECTED_COMMAND);
  });

  it('ledger_hook_config: the matcher selects src/ledger and src/zk files and nothing else', () => {
    const { matcher } = readSaveHook();
    expect(typeof matcher).toBe('string');
    if (typeof matcher !== 'string') throw new Error('UNREACHABLE');
    const pattern = new RegExp(matcher);
    for (const path of MATCHING_PATHS) expect(pattern.test(path)).toBe(true);
    for (const path of NON_MATCHING_PATHS) expect(pattern.test(path)).toBe(false);
  });

  it('ledger_hook_config: vite.config.ts excludes tests/zk/proof/** from the default test run', () => {
    const config = readFileSync(VITE_CONFIG_FILE, 'utf8');
    expect(/exclude\s*:\s*\[[^\]]*tests\/zk\/proof\/\*\*[^\]]*\]/.test(config)).toBe(true);
  });
});

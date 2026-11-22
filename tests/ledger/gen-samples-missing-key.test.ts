import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { generateSamples } from '../../scripts/gen-samples';

// Test gen_samples_missing_key (ledger-format Requirement 7.5, example, one run).
//
// An unusable Demo_Key file makes the Sample_Writer fail with the fixed message
// `DEMO KEY FILE UNUSABLE`, write no file and never create a key. Checked through the exported
// function (missing file, file that is not JSON, JSON without `d`) and through the command-line
// wrapper (exit status 1, stderr is exactly that line, stdout empty).
//
// Synthetic data only. The invalid key files made here hold no key material. Failure messages
// compare booleans and fixed strings, never file contents.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXED_MESSAGE = 'DEMO KEY FILE UNUSABLE';
const TIMEOUT_MS = 120_000;

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cryptterm-missing-key-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

interface Layout {
  readonly dir: string;
  readonly keyFile: string;
  readonly outDir: string;
  readonly trustedKeysFile: string;
}

/** A fresh temp tree: an existing empty `out/` and a `trusted-keys.ts` path that does not exist. */
function makeLayout(): Layout {
  const dir = makeTempDir();
  return {
    dir,
    keyFile: join(dir, 'key.json'),
    outDir: mkdtempSync(join(dir, 'out-')),
    trustedKeysFile: join(dir, 'trusted-keys.ts'),
  };
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error ?? new Error('NOTHING THROWN VALUE');
  }
  return undefined;
}

function expectNothingWritten(layout: Layout): void {
  expect(readdirSync(layout.outDir).length).toBe(0);
  expect(existsSync(layout.trustedKeysFile)).toBe(false);
}

describe('gen_samples_missing_key', () => {
  it(
    'gen_samples_missing_key: a key file path that does not exist rejects and creates nothing',
    async () => {
      const layout = makeLayout();
      const error = await captureRejection(
        generateSamples({
          keyFile: layout.keyFile,
          outDir: layout.outDir,
          trustedKeysFile: layout.trustedKeysFile,
        }),
      );
      expect(error instanceof Error).toBe(true);
      expect(error instanceof Error && error.message === FIXED_MESSAGE).toBe(true);
      expectNothingWritten(layout);
      // The writer must not generate a key at the missing path.
      expect(existsSync(layout.keyFile)).toBe(false);
    },
    TIMEOUT_MS,
  );

  it(
    'gen_samples_missing_key: a key file that is not JSON rejects and leaves the file unchanged',
    async () => {
      const layout = makeLayout();
      const original = 'this is not json\n';
      writeFileSync(layout.keyFile, original);
      const error = await captureRejection(
        generateSamples({
          keyFile: layout.keyFile,
          outDir: layout.outDir,
          trustedKeysFile: layout.trustedKeysFile,
        }),
      );
      expect(error instanceof Error).toBe(true);
      expect(error instanceof Error && error.message === FIXED_MESSAGE).toBe(true);
      expectNothingWritten(layout);
      expect(readFileSync(layout.keyFile, 'utf8') === original).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    'gen_samples_missing_key: a JWK without d rejects and leaves the file unchanged',
    async () => {
      const layout = makeLayout();
      // A public-only JWK shape with a dummy x. No key material: 43 base64url characters of 'A'.
      const original = `${JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: 'A'.repeat(43) }, null, 2)}\n`;
      writeFileSync(layout.keyFile, original);
      const error = await captureRejection(
        generateSamples({
          keyFile: layout.keyFile,
          outDir: layout.outDir,
          trustedKeysFile: layout.trustedKeysFile,
        }),
      );
      expect(error instanceof Error).toBe(true);
      expect(error instanceof Error && error.message === FIXED_MESSAGE).toBe(true);
      expectNothingWritten(layout);
      expect(readFileSync(layout.keyFile, 'utf8') === original).toBe(true);
    },
    TIMEOUT_MS,
  );

  it(
    'gen_samples_missing_key: the command-line wrapper exits 1 with the fixed line on stderr and writes nothing',
    () => {
      const layout = makeLayout();
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          './scripts/register-ts.mjs',
          'scripts/gen-samples.ts',
          '--key-file',
          layout.keyFile,
          '--out-dir',
          layout.outDir,
          '--trusted-keys-file',
          layout.trustedKeysFile,
        ],
        { cwd: REPO_ROOT, encoding: 'utf8', timeout: TIMEOUT_MS },
      );
      expect(result.status).toBe(1);
      expect(result.stderr === `${FIXED_MESSAGE}\n`).toBe(true);
      expect(result.stdout).toBe('');
      expectNothingWritten(layout);
      expect(existsSync(layout.keyFile)).toBe(false);
    },
    TIMEOUT_MS,
  );
});

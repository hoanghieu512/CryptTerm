import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateSamples } from '../../scripts/gen-samples';
import { generateBatch } from '../../src/ledger/generate';
import type { GeneratorKind } from '../../src/ledger/generate';
import { parseBatch } from '../../src/ledger/parse';
import { serializeBatch } from '../../src/ledger/serialize';
import { batchRoot } from '../../src/zk/batch-root';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Test samples_reproducible (ledger-format Requirements 7.4, 8.1, 8.3, 8.5, example, one run).
//
// Runs the Sample_Writer into temporary directories, with the real Demo_Key file (reading it in a
// test is allowed, it is public by design). Checks:
//   - two runs give byte-identical files, signatures included;
//   - the files equal the committed `public/samples/*` and `src/ledger/trusted-keys.ts`;
//   - the stdout lines are only `<file name> <record count>` (and `trusted-keys.ts` alone), both
//     from `generateSamples` and from the command-line wrapper;
//   - the sample table of the design (kind, seed, count, batchId).
// Nothing is printed. Failure messages compare booleans, never file contents.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const KEY_FILE = join(REPO_ROOT, 'scripts', 'demo-key', 'DEMO_ONLY_core_ledger_key.json');
const COMMITTED_SAMPLES_DIR = join(REPO_ROOT, 'public', 'samples');
const COMMITTED_TRUSTED_KEYS = join(REPO_ROOT, 'src', 'ledger', 'trusted-keys.ts');
const TRUSTED_KEYS_NAME = 'trusted-keys.ts';
const WASM_TIMEOUT_MS = 120_000;

interface SampleSpec {
  readonly name: string;
  readonly kind: GeneratorKind;
  readonly seed: number;
  readonly count: number;
  readonly batchId: string;
}

// The sample table of design.md "Samples and Sample_Writer" ("Fixed samples").
const SAMPLES: readonly SampleSpec[] = [
  { name: 'clean', kind: 'clean', seed: 1001, count: 12, batchId: 'CTB-20261201-001' },
  { name: 'over-limit-unflagged', kind: 'overLimitUnflagged', seed: 1002, count: 12, batchId: 'CTB-20261201-002' },
  { name: 'unbalanced', kind: 'unbalanced', seed: 1003, count: 12, batchId: 'CTB-20261201-003' },
  { name: 'large', kind: 'large', seed: 1004, count: 64, batchId: 'CTB-20261201-004' },
];

const SAMPLE_FILE_NAMES: readonly string[] = SAMPLES.flatMap((s) => [`${s.name}.dat`, `${s.name}.digest.json`]);
const ALL_FILE_NAMES: readonly string[] = [...SAMPLE_FILE_NAMES, TRUSTED_KEYS_NAME];

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cryptterm-samples-'));
  tempDirs.push(dir);
  return dir;
}

interface Run {
  readonly outDir: string;
  readonly trustedKeysFile: string;
}

function makeRun(): Run {
  const dir = makeTempDir();
  // The output directory exists and is empty, as `public/samples/` does in the repo.
  const outDir = join(dir, 'samples');
  mkdirSync(outDir);
  return { outDir, trustedKeysFile: join(dir, TRUSTED_KEYS_NAME) };
}

/** Bytes of one produced file: a sample file from `outDir`, or the trusted keys file. */
function readProduced(run: Run, fileName: string): Buffer {
  return readFileSync(fileName === TRUSTED_KEYS_NAME ? run.trustedKeysFile : join(run.outDir, fileName));
}

function readCommitted(fileName: string): Buffer {
  return readFileSync(fileName === TRUSTED_KEYS_NAME ? COMMITTED_TRUSTED_KEYS : join(COMMITTED_SAMPLES_DIR, fileName));
}

/** The record count a stdout line must show for a file, or undefined for `trusted-keys.ts`. */
function expectedCount(fileName: string): number | undefined {
  const sample = SAMPLES.find((s) => fileName === `${s.name}.dat` || fileName === `${s.name}.digest.json`);
  return sample?.count;
}

/** Checks the form of every stdout line and that every one of the nine files is named once. */
function expectOutputForm(lines: readonly string[]): void {
  expect(lines.length).toBe(ALL_FILE_NAMES.length);
  const seen: string[] = [];
  for (const line of lines) {
    if (line === TRUSTED_KEYS_NAME) {
      seen.push(TRUSTED_KEYS_NAME);
      continue;
    }
    const match = /^([a-z-]+\.(?:dat|digest\.json)) ([0-9]+)$/.exec(line);
    expect(match === null).toBe(false);
    const fileName = match?.[1] ?? '';
    const count = match?.[2] ?? '';
    expect(SAMPLE_FILE_NAMES.includes(fileName)).toBe(true);
    expect(count === String(expectedCount(fileName))).toBe(true);
    seen.push(fileName);
  }
  expect([...seen].sort()).toEqual([...ALL_FILE_NAMES].sort());
}

function expectRunsEqual(a: Run, b: Run): void {
  for (const fileName of ALL_FILE_NAMES) {
    expect(readProduced(a, fileName).equals(readProduced(b, fileName))).toBe(true);
  }
}

function expectRunEqualsCommitted(run: Run): void {
  for (const fileName of ALL_FILE_NAMES) {
    expect(readProduced(run, fileName).equals(readCommitted(fileName))).toBe(true);
  }
}

describe('samples_reproducible', () => {
  let env: HasherEnv;
  let runA: Run;
  let runB: Run;
  let runCli: Run;
  let linesA: readonly string[];
  let linesB: readonly string[];
  let cliStdout: string;
  let cliStderr: string;
  let cliStatus: number | null;

  beforeAll(async () => {
    env = await createHasherEnv();
    runA = makeRun();
    runB = makeRun();
    runCli = makeRun();
    linesA = await generateSamples({ keyFile: KEY_FILE, outDir: runA.outDir, trustedKeysFile: runA.trustedKeysFile });
    linesB = await generateSamples({ keyFile: KEY_FILE, outDir: runB.outDir, trustedKeysFile: runB.trustedKeysFile });
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        './scripts/register-ts.mjs',
        'scripts/gen-samples.ts',
        '--key-file',
        KEY_FILE,
        '--out-dir',
        runCli.outDir,
        '--trusted-keys-file',
        runCli.trustedKeysFile,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: WASM_TIMEOUT_MS },
    );
    cliStdout = result.stdout;
    cliStderr = result.stderr;
    cliStatus = result.status;
  }, WASM_TIMEOUT_MS * 3);

  afterAll(async () => {
    await env.destroy();
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('samples_reproducible: two runs write the same nine files byte for byte, signatures included', () => {
    expect(ALL_FILE_NAMES.length).toBe(9);
    expectRunsEqual(runA, runB);
  });

  it('samples_reproducible: a fresh run equals the committed public/samples/* and src/ledger/trusted-keys.ts', () => {
    expectRunEqualsCommitted(runA);
    expectRunEqualsCommitted(runB);
  });

  it('samples_reproducible: stdout lines have the form "<file name> <record count>" and run to run they are equal', () => {
    expectOutputForm(linesA);
    expectOutputForm(linesB);
    expect([...linesA]).toEqual([...linesB]);
  });

  it('samples_reproducible: the command-line wrapper exits 0, prints only that form, and writes the same bytes', () => {
    expect(cliStatus).toBe(0);
    expect(cliStderr).toBe('');
    expect(cliStdout.endsWith('\n')).toBe(true);
    const cliLines = cliStdout.slice(0, -1).split('\n');
    expectOutputForm(cliLines);
    expect(cliLines).toEqual([...linesA]);
    expectRunsEqual(runA, runCli);
    expectRunEqualsCommitted(runCli);
  });

  it('samples_reproducible: the produced batches follow the sample table (kind, seed, count, batch id)', () => {
    for (const spec of SAMPLES) {
      const text = readProduced(runA, `${spec.name}.dat`).toString('latin1');
      const lines = text.split('\n');
      // header, N postings, trailer, and an empty piece after the final LF
      expect(lines.length).toBe(spec.count + 3);
      expect(lines[0]?.startsWith(`H${spec.batchId}`)).toBe(true);
      expect(lines[spec.count + 1]?.startsWith(`T${spec.batchId}${String(spec.count).padStart(2, '0')}`)).toBe(true);

      const batch = parseBatch(text);
      expect(batch.batchId).toBe(spec.batchId);
      expect(batch.postings.length).toBe(spec.count);

      // The seed and kind of the table: the file is the generator output for them.
      const generated = generateBatch({ kind: spec.kind, seed: spec.seed, count: spec.count, batchId: spec.batchId });
      expect(serializeBatch(generated) === text).toBe(true);

      const digest: unknown = JSON.parse(readProduced(runA, `${spec.name}.digest.json`).toString('utf8'));
      expect(typeof digest === 'object' && digest !== null).toBe(true);
      const fields = digest as Record<string, unknown>; // narrowed to an object just above
      expect(fields['batchId']).toBe(spec.batchId);
      expect(fields['recordCount']).toBe(spec.count);
    }
  });

  it(
    'samples_reproducible: the produced digest root equals the root of the produced batch',
    async () => {
      for (const spec of SAMPLES) {
        const batch = parseBatch(readProduced(runA, `${spec.name}.dat`).toString('latin1'));
        const digest = JSON.parse(readProduced(runA, `${spec.name}.digest.json`).toString('utf8')) as Record<
          string,
          unknown
        >; // JSON object checked by the sibling tests; only one field is read
        const root = await batchRoot(env.hasher, batch);
        expect(digest['merkleRoot'] === `0x${root.toString(16).padStart(64, '0')}`).toBe(true);
      }
    },
    WASM_TIMEOUT_MS,
  );
});

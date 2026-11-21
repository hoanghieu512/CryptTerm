import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { BackendType, Barretenberg } from '@aztec-foundation/bb.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSrs, parseSrsManifest, SrsError } from '../../src/zk/srs';
import type { SrsManifest, SrsSource } from '../../src/zk/srs';
// Requirements 14.6 (SRS sha256 test), 14.2 and 14.8 (the point count covers the circuit).
//
// Reads the committed SRS files, the manifest, `.kiro/steering/noir.md` and the committed
// Artifact. It calls no prover and makes no network request: the one `Barretenberg`
// instance is created with `skipSrsInit: true` and is only asked for `circuitStats`.
// The validators below are written in this file on purpose, so the test does not rely on
// the code under test (`parseSrsManifest`, `loadSrs`) to judge the committed files. The
// mutated cases run the same validators on in-memory copies. No committed file is changed.
const SRS_DIR = new URL('../../src/zk/artifacts/srs/', import.meta.url);
const MANIFEST_PATH = fileURLToPath(new URL('srs.sha256.json', SRS_DIR));
const G1_PATH = fileURLToPath(new URL('g1.dat', SRS_DIR));
const G2_PATH = fileURLToPath(new URL('g2.dat', SRS_DIR));
const NOIR_MD_PATH = fileURLToPath(new URL('../../.kiro/steering/noir.md', import.meta.url));
const ARTIFACT_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.json', import.meta.url),
);

const G2_BYTES = 128;
const G2_SHA256 = '01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f';
const MIN_POINTS = 512;
const WASM_TIMEOUT_MS = 120_000;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ENTRY_KEYS = ['bytes', 'sha256', 'source', 'mirror', 'byteRange'] as const;
const FILE_NAMES = ['g1.dat', 'g2.dat'] as const;

/** Same settings as task 5.1 and the prover (`PROOF_SETTINGS`). */
const PROOF_SETTINGS = {
  ipaAccumulation: false,
  oracleHashType: 'poseidon2',
  disableZk: false,
  optimizedSolidityVerifier: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function readIfExists(path: string): Buffer | undefined {
  return existsSync(path) ? readFileSync(path) : undefined;
}

// ---------------------------------------------------------------------------
// Requirement 14.6: the validator
// ---------------------------------------------------------------------------

interface SrsInputs {
  /** `undefined` when the manifest file is missing. */
  readonly manifestText: string | undefined;
  /** `undefined` when the data file is missing. */
  readonly g1: Uint8Array | undefined;
  readonly g2: Uint8Array | undefined;
  /** Text of `.kiro/steering/noir.md`; `undefined` when it is missing. */
  readonly noirText: string | undefined;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Key and type checks for one `files[...]` entry. Returns messages, or none when valid. */
function validateEntry(name: string, entry: unknown): string[] {
  if (!isRecord(entry)) return [`files["${name}"] is missing or not an object`];
  const problems: string[] = [];
  for (const key of ENTRY_KEYS) {
    if (!(key in entry)) problems.push(`files["${name}"].${key} is missing`);
  }
  if ('bytes' in entry && !isPositiveSafeInteger(entry['bytes'])) {
    problems.push(`files["${name}"].bytes is not a positive integer`);
  }
  if ('sha256' in entry) {
    const hash = entry['sha256'];
    if (typeof hash !== 'string' || !SHA256_HEX.test(hash)) {
      problems.push(`files["${name}"].sha256 is not 64 lowercase hex characters`);
    }
  }
  for (const key of ['source', 'mirror'] as const) {
    if (key in entry && typeof entry[key] !== 'string') {
      problems.push(`files["${name}"].${key} is not a string`);
    }
  }
  if ('byteRange' in entry && entry['byteRange'] !== null && typeof entry['byteRange'] !== 'string') {
    problems.push(`files["${name}"].byteRange is neither a string nor null`);
  }
  return problems;
}

/**
 * Returns one message per violated rule. An empty list means: the manifest parses and has
 * every key, both hashes are 64 lowercase hex, `pointCount * bytesPerPoint` equals the
 * `g1.dat` `bytes`, both data files exist with the manifest length and sha256, `g2.dat`
 * is 128 bytes with the canonical sha256, and both manifest hashes appear in `noir.md`.
 */
function validateSrs(input: SrsInputs): string[] {
  const problems: string[] = [];
  if (input.manifestText === undefined) return ['manifest file is missing'];

  let manifest: unknown;
  try {
    manifest = JSON.parse(input.manifestText);
  } catch {
    return ['manifest is not valid JSON'];
  }
  if (!isRecord(manifest)) return ['manifest is not a JSON object'];

  if (!('format' in manifest) || typeof manifest['format'] !== 'string') {
    problems.push('format is missing or not a string');
  }
  if (!('pointCount' in manifest) || !isPositiveSafeInteger(manifest['pointCount'])) {
    problems.push('pointCount is missing or not a positive integer');
  }
  if (!('bytesPerPoint' in manifest) || !isPositiveSafeInteger(manifest['bytesPerPoint'])) {
    problems.push('bytesPerPoint is missing or not a positive integer');
  }
  const files = manifest['files'];
  if (!isRecord(files)) {
    problems.push('files is missing or not an object');
    return problems;
  }
  for (const name of FILE_NAMES) problems.push(...validateEntry(name, files[name]));
  if (problems.length > 0) return problems;

  // Every key is present and well typed from here on.
  const pointCount = manifest['pointCount'] as number;
  const bytesPerPoint = manifest['bytesPerPoint'] as number;
  const entries = {
    'g1.dat': files['g1.dat'] as { bytes: number; sha256: string },
    'g2.dat': files['g2.dat'] as { bytes: number; sha256: string },
  };

  if (pointCount * bytesPerPoint !== entries['g1.dat'].bytes) {
    problems.push('pointCount * bytesPerPoint differs from the g1.dat bytes');
  }

  const data = { 'g1.dat': input.g1, 'g2.dat': input.g2 };
  for (const name of FILE_NAMES) {
    const bytes = data[name];
    if (bytes === undefined) {
      problems.push(`${name} is missing`);
      continue;
    }
    if (bytes.length !== entries[name].bytes) {
      problems.push(`${name} length differs from the manifest`);
    }
    if (sha256Hex(bytes) !== entries[name].sha256) {
      problems.push(`${name} sha256 differs from the manifest`);
    }
  }

  // The canonical g2 checks use constants, not the manifest.
  if (input.g2 !== undefined) {
    if (input.g2.length !== G2_BYTES) problems.push('g2.dat is not 128 bytes');
    if (sha256Hex(input.g2) !== G2_SHA256) problems.push('g2.dat sha256 is not the canonical value');
  }
  if (entries['g2.dat'].sha256 !== G2_SHA256) {
    problems.push('manifest g2.dat sha256 is not the canonical value');
  }
  if (entries['g2.dat'].bytes !== G2_BYTES) problems.push('manifest g2.dat bytes is not 128');

  // The manifest and the record in noir.md must agree.
  if (input.noirText === undefined) {
    problems.push('noir.md is missing');
  } else {
    for (const name of FILE_NAMES) {
      if (!input.noirText.includes(entries[name].sha256)) {
        problems.push(`${name} sha256 is absent from noir.md`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Requirements 14.2 and 14.8: the size rule
// ---------------------------------------------------------------------------

/** Points the prover needs for a circuit whose dyadic size is `numGatesDyadic`. */
function requiredPoints(numGatesDyadic: number): number {
  return Math.max(numGatesDyadic, MIN_POINTS);
}

function isPowerOfTwo(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

/** True when `pointCount` is a power of two and covers `requiredPoints(numGatesDyadic)`. */
function isEnough(pointCount: number, numGatesDyadic: number): boolean {
  return isPowerOfTwo(pointCount) && pointCount >= requiredPoints(numGatesDyadic);
}

// ---------------------------------------------------------------------------
// Committed inputs
// ---------------------------------------------------------------------------

function readCommitted(): SrsInputs {
  const manifestBytes = readIfExists(MANIFEST_PATH);
  const noirBytes = readIfExists(NOIR_MD_PATH);
  return {
    manifestText: manifestBytes?.toString('utf8'),
    g1: readIfExists(G1_PATH),
    g2: readIfExists(G2_PATH),
    noirText: noirBytes?.toString('utf8'),
  };
}

const committed = readCommitted();

function committedManifestObject(): Record<string, unknown> {
  expect(committed.manifestText).toBeDefined();
  const parsed: unknown = JSON.parse(committed.manifestText ?? '');
  if (!isRecord(parsed)) throw new Error('committed manifest is not an object');
  // A deep copy, so a mutation never touches the shared parse result.
  return structuredClone(parsed);
}

function committedBytes(name: 'g1' | 'g2'): Uint8Array {
  const bytes = committed[name];
  if (bytes === undefined) throw new Error(`${name}.dat is missing`);
  return new Uint8Array(bytes);
}

function manifestEntry(manifest: Record<string, unknown>, name: string): Record<string, unknown> {
  const files = manifest['files'];
  if (!isRecord(files)) throw new Error('files is not an object');
  const entry = files[name];
  if (!isRecord(entry)) throw new Error(`${name} is not an object`);
  return entry;
}

function withFiles(manifest: Record<string, unknown>): Record<string, unknown> {
  const files = manifest['files'];
  if (!isRecord(files)) throw new Error('files is not an object');
  return files;
}

function flipByte(bytes: Uint8Array, index: number): Uint8Array {
  const copy = new Uint8Array(bytes);
  copy[index] = (copy[index] ?? 0) ^ 0x01;
  return copy;
}

function asInputs(manifest: Record<string, unknown>, rest: Partial<SrsInputs> = {}): SrsInputs {
  return { ...committed, manifestText: JSON.stringify(manifest), ...rest };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SRS files and manifest (Requirement 14.6)', () => {
  it('the committed files pass every check', () => {
    expect(validateSrs(committed)).toEqual([]);
  });

  it('the committed manifest has the expected shape and sizes', () => {
    const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
    expect(manifest.pointCount * manifest.bytesPerPoint).toBe(manifest.files['g1.dat'].bytes);
    expect(manifest.files['g2.dat'].bytes).toBe(G2_BYTES);
    expect(manifest.files['g2.dat'].sha256).toBe(G2_SHA256);
    expect(committed.g1?.length).toBe(manifest.files['g1.dat'].bytes);
    expect(committed.g2?.length).toBe(G2_BYTES);
  });

  it('noir.md is read from disk and holds both manifest hashes', () => {
    const noirText = readFileSync(NOIR_MD_PATH, 'utf8');
    const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
    expect(noirText).toContain(manifest.files['g1.dat'].sha256);
    expect(noirText).toContain(manifest.files['g2.dat'].sha256);
  });

  interface MutatedCase {
    readonly name: string;
    readonly build: () => SrsInputs;
    /** Set when the manifest is well-formed JSON whose shape `parseSrsManifest` must also refuse. */
    readonly parserRejects?: boolean;
  }

  const mutated: MutatedCase[] = [];

  mutated.push({
    name: 'manifest file missing',
    build: () => ({ ...committed, manifestText: undefined }),
  });
  mutated.push({
    name: 'manifest is not valid JSON',
    build: () => ({ ...committed, manifestText: '{ "format": ' }),
  });
  mutated.push({
    name: 'manifest is a JSON array',
    build: () => ({ ...committed, manifestText: '[]' }),
  });

  for (const key of ['format', 'pointCount', 'bytesPerPoint', 'files'] as const) {
    mutated.push({
      name: `manifest lacks "${key}"`,
      parserRejects: true,
      build: () => {
        const manifest = committedManifestObject();
        delete manifest[key];
        return asInputs(manifest);
      },
    });
  }
  for (const file of FILE_NAMES) {
    mutated.push({
      name: `manifest lacks files["${file}"]`,
      parserRejects: true,
      build: () => {
        const manifest = committedManifestObject();
        delete withFiles(manifest)[file];
        return asInputs(manifest);
      },
    });
    for (const key of ENTRY_KEYS) {
      mutated.push({
        name: `files["${file}"] lacks "${key}"`,
        parserRejects: true,
        build: () => {
          const manifest = committedManifestObject();
          delete manifestEntry(manifest, file)[key];
          return asInputs(manifest);
        },
      });
    }
  }

  const badHashes: ReadonlyArray<readonly [string, (good: string) => string]> = [
    ['uppercase hex', (good) => good.toUpperCase()],
    ['63 characters', (good) => good.slice(1)],
    ['65 characters', (good) => `${good}0`],
    ['non-hex character', (good) => `g${good.slice(1)}`],
    ['empty string', () => ''],
  ];
  for (const file of FILE_NAMES) {
    for (const [label, mutate] of badHashes) {
      mutated.push({
        name: `files["${file}"].sha256 is ${label}`,
        parserRejects: true,
        build: () => {
          const manifest = committedManifestObject();
          const entry = manifestEntry(manifest, file);
          entry['sha256'] = mutate(String(entry['sha256']));
          return asInputs(manifest);
        },
      });
    }
  }

  mutated.push({
    name: 'g1.dat "bytes" is wrong in the manifest',
    build: () => {
      const manifest = committedManifestObject();
      const entry = manifestEntry(manifest, 'g1.dat');
      entry['bytes'] = Number(entry['bytes']) + 64;
      return asInputs(manifest);
    },
  });
  mutated.push({
    name: 'pointCount is wrong in the manifest',
    build: () => {
      const manifest = committedManifestObject();
      manifest['pointCount'] = Number(manifest['pointCount']) / 2;
      return asInputs(manifest);
    },
  });
  mutated.push({
    name: 'bytesPerPoint is wrong in the manifest',
    build: () => {
      const manifest = committedManifestObject();
      manifest['bytesPerPoint'] = 32;
      return asInputs(manifest);
    },
  });
  mutated.push({ name: 'g1.dat is missing', build: () => ({ ...committed, g1: undefined }) });
  mutated.push({ name: 'g2.dat is missing', build: () => ({ ...committed, g2: undefined }) });
  mutated.push({
    name: 'g1.dat has one flipped byte (first)',
    build: () => ({ ...committed, g1: flipByte(committedBytes('g1'), 0) }),
  });
  mutated.push({
    name: 'g1.dat has one flipped byte (last)',
    build: () => {
      const g1 = committedBytes('g1');
      return { ...committed, g1: flipByte(g1, g1.length - 1) };
    },
  });
  mutated.push({
    name: 'g1.dat is truncated by one byte',
    build: () => ({ ...committed, g1: committedBytes('g1').subarray(0, -1) }),
  });
  mutated.push({
    name: 'g1.dat is empty',
    build: () => ({ ...committed, g1: new Uint8Array(0) }),
  });
  mutated.push({
    name: 'g2.dat has one flipped byte',
    build: () => ({ ...committed, g2: flipByte(committedBytes('g2'), 5) }),
  });
  mutated.push({
    name: 'g2.dat has the wrong length (129 bytes)',
    build: () => {
      const wrong = new Uint8Array(G2_BYTES + 1);
      wrong.set(committedBytes('g2'));
      return { ...committed, g2: wrong };
    },
  });
  mutated.push({
    name: 'g2.dat has the wrong length (127 bytes)',
    build: () => ({ ...committed, g2: committedBytes('g2').subarray(0, G2_BYTES - 1) }),
  });
  mutated.push({
    name: 'manifest g2.dat sha256 is a valid hash but not the canonical constant',
    build: () => {
      const manifest = committedManifestObject();
      manifestEntry(manifest, 'g2.dat')['sha256'] = '0'.repeat(64);
      return asInputs(manifest);
    },
  });
  mutated.push({
    name: 'g2.dat and its manifest hash agree but differ from the canonical constant',
    build: () => {
      const g2 = flipByte(committedBytes('g2'), 0);
      const manifest = committedManifestObject();
      manifestEntry(manifest, 'g2.dat')['sha256'] = sha256Hex(g2);
      return asInputs(manifest, { g2 });
    },
  });
  mutated.push({
    name: 'noir.md file is missing',
    build: () => ({ ...committed, noirText: undefined }),
  });
  mutated.push({
    name: 'noir.md lacks the g1.dat sha256',
    build: () => {
      const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
      const text = (committed.noirText ?? '').split(manifest.files['g1.dat'].sha256).join('');
      return { ...committed, noirText: text };
    },
  });
  mutated.push({
    name: 'noir.md lacks the g2.dat sha256',
    build: () => {
      const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
      const text = (committed.noirText ?? '').split(manifest.files['g2.dat'].sha256).join('');
      return { ...committed, noirText: text };
    },
  });
  mutated.push({
    name: 'noir.md holds a one-character-off g1.dat sha256',
    build: () => {
      const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
      const good = manifest.files['g1.dat'].sha256;
      const off = `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`;
      const text = (committed.noirText ?? '').split(good).join(off);
      return { ...committed, noirText: text };
    },
  });

  it.each(mutated.map((m) => [m.name, m] as const))('rejects: %s', (_name, mutation) => {
    const input = mutation.build();
    expect(validateSrs(input)).not.toEqual([]);
    if (mutation.parserRejects === true) {
      expect(input.manifestText).toBeDefined();
      expect(() => parseSrsManifest(JSON.parse(input.manifestText ?? ''))).toThrow(SrsError);
    }
  });

  it('every mutated case really differs from the committed inputs', () => {
    expect(mutated.length).toBeGreaterThanOrEqual(40);
    for (const mutation of mutated) {
      const input = mutation.build();
      const same =
        input.manifestText === committed.manifestText &&
        input.noirText === committed.noirText &&
        input.g1 !== undefined &&
        input.g2 !== undefined &&
        Buffer.compare(input.g1, committed.g1 ?? new Uint8Array(0)) === 0 &&
        Buffer.compare(input.g2, committed.g2 ?? new Uint8Array(0)) === 0;
      expect(same, mutation.name).toBe(false);
    }
  });
});

describe('loadSrs over the committed bytes (Requirement 14.6)', () => {
  function manifestFromDisk(): SrsManifest {
    return parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
  }
  function sourceOf(g1: Uint8Array, g2: Uint8Array): SrsSource {
    return { readG1: () => Promise.resolve(g1), readG2: () => Promise.resolve(g2) };
  }

  it('accepts the committed files', async () => {
    const manifest = manifestFromDisk();
    const srs = await loadSrs(sourceOf(committedBytes('g1'), committedBytes('g2')), manifest);
    expect(srs.pointCount).toBe(manifest.pointCount);
    expect(srs.g1.length).toBe(manifest.files['g1.dat'].bytes);
    expect(srs.g2.length).toBe(G2_BYTES);
  });

  it('rejects a flipped byte with SRS_HASH', async () => {
    const source = sourceOf(flipByte(committedBytes('g1'), 1000), committedBytes('g2'));
    await expect(loadSrs(source, manifestFromDisk())).rejects.toMatchObject({ code: 'SRS_HASH' });
  });

  it('rejects a failing source with SRS_FETCH', async () => {
    const source: SrsSource = {
      readG1: () => Promise.reject(new Error('offline')),
      readG2: () => Promise.resolve(committedBytes('g2')),
    };
    await expect(loadSrs(source, manifestFromDisk())).rejects.toMatchObject({ code: 'SRS_FETCH' });
  });
});

describe('the size rule (Requirements 14.2, 14.8)', () => {
  const table: ReadonlyArray<readonly [string, number, number, boolean]> = [
    ['16384 points for a dyadic size of 32768', 16384, 32768, false],
    ['32768 points for a dyadic size of 32768', 32768, 32768, true],
    ['65536 points for a dyadic size of 32768', 65536, 32768, true],
    ['256 points for a dyadic size of 256 (below the 512 floor)', 256, 256, false],
    ['512 points for a dyadic size of 256', 512, 256, true],
    ['32768 points for a dyadic size of 65536', 32768, 65536, false],
    ['a non-power-of-two count that is large enough', 40000, 32768, false],
    ['zero points', 0, 256, false],
  ];

  it('requires at least 512 points', () => {
    expect(requiredPoints(256)).toBe(512);
    expect(requiredPoints(512)).toBe(512);
    expect(requiredPoints(32768)).toBe(32768);
  });

  it.each(table.map((row) => [...row] as const))('%s', (_label, points, dyadic, expected) => {
    expect(isEnough(points, dyadic)).toBe(expected);
  });

  describe('against the committed Artifact', () => {
    let api: Barretenberg | undefined;
    let numGatesDyadic = 0;
    let numGates = 0;

    beforeAll(async () => {
      const artifact: unknown = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
      if (!isRecord(artifact) || typeof artifact['bytecode'] !== 'string') {
        throw new Error('Artifact has no bytecode string');
      }
      const bytecode = new Uint8Array(gunzipSync(Buffer.from(artifact['bytecode'], 'base64')));
      // `skipSrsInit: true`: no SRS is loaded and nothing is downloaded.
      api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
      const stats = await api.circuitStats({
        circuit: { name: 'ledger_audit', bytecode, verificationKey: new Uint8Array(0) },
        includeGatesPerOpcode: false,
        settings: PROOF_SETTINGS,
      });
      numGates = stats.numGates;
      numGatesDyadic = stats.numGatesDyadic;
    }, WASM_TIMEOUT_MS);

    afterAll(async () => {
      await api?.destroy();
    }, WASM_TIMEOUT_MS);

    it('the point count is a power of two that covers max(numGatesDyadic, 512)', () => {
      const manifest = parseSrsManifest(JSON.parse(committed.manifestText ?? ''));
      expect(numGates).toBeGreaterThan(0);
      expect(numGatesDyadic).toBeGreaterThanOrEqual(numGates);
      expect(isPowerOfTwo(manifest.pointCount)).toBe(true);
      expect(manifest.pointCount).toBeGreaterThanOrEqual(requiredPoints(numGatesDyadic));
      expect(isEnough(manifest.pointCount, numGatesDyadic)).toBe(true);
      // The g1 file holds exactly the points the manifest names.
      expect(committed.g1?.length).toBe(manifest.pointCount * manifest.bytesPerPoint);
    });
  });
});

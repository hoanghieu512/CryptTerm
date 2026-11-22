// Sample_Writer (ledger-format Requirements 7.5, 8, design "Samples and Sample_Writer").
//
// The only code in the repo that signs. It reads the DEMO ONLY core-ledger key, generates the four
// fixed sample batches, signs the digest of each, and writes `<name>.dat` and `<name>.digest.json`
// into the output directory and the generated `src/ledger/trusted-keys.ts`.
//
// Run: `npm run gen:samples` (plain Node with `scripts/register-ts.mjs`, which lets extensionless
// imports of `.ts` files resolve).
//
// Rules kept here:
//   - The key file is read and validated first. If it is missing, unreadable or invalid, the error
//     message is exactly `DEMO KEY FILE UNUSABLE`, nothing is written and no key is ever generated.
//   - Everything is computed in memory first and checked with `verifyDigest`. Files are written last.
//   - Deterministic: fixed seeds, no clock, no `Math.random`, deterministic Ed25519 and Poseidon2.
//   - Output is only `<file name> <record count>` lines and the line `trusted-keys.ts`. Error lines
//     hold a fixed message and no value. The key material is never printed.
//   - Seeded salts are for demo determinism and are not random.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digestMessage, verifyDigest } from '../src/ledger/digest';
import type { SignedDigest } from '../src/ledger/digest';
import { generateBatch } from '../src/ledger/generate';
import type { GeneratorKind } from '../src/ledger/generate';
import { serializeBatch } from '../src/ledger/serialize';
import { batchRoot } from '../src/zk/batch-root';
import { createHasher } from '../src/zk/hash';
import type { Hasher } from '../src/zk/hash';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_KEY_FILE = resolve(REPO_ROOT, 'scripts', 'demo-key', 'DEMO_ONLY_core_ledger_key.json');
const DEFAULT_OUT_DIR = resolve(REPO_ROOT, 'public', 'samples');
const DEFAULT_TRUSTED_KEYS_FILE = resolve(REPO_ROOT, 'src', 'ledger', 'trusted-keys.ts');

const KEY_UNUSABLE = 'DEMO KEY FILE UNUSABLE';
const SELF_CHECK_FAILED = 'SAMPLE SIGNATURE SELF CHECK FAILED';
const GENERATION_FAILED = 'SAMPLE GENERATION FAILED';
const ARGUMENTS_INVALID = 'GEN-SAMPLES ARGUMENTS INVALID';

const TRUSTED_KEYS_NAME = 'trusted-keys.ts';
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

interface SampleSpec {
  readonly name: string;
  readonly kind: GeneratorKind;
  readonly seed: number;
  readonly count: number;
  readonly batchId: string;
}

// The sample table of design.md "Generator" ("Fixed samples"). The order is part of the output.
const SAMPLES: readonly SampleSpec[] = [
  { name: 'clean', kind: 'clean', seed: 1001, count: 12, batchId: 'CTB-20261201-001' },
  { name: 'over-limit-unflagged', kind: 'overLimitUnflagged', seed: 1002, count: 12, batchId: 'CTB-20261201-002' },
  { name: 'unbalanced', kind: 'unbalanced', seed: 1003, count: 12, batchId: 'CTB-20261201-003' },
  { name: 'large', kind: 'large', seed: 1004, count: 64, batchId: 'CTB-20261201-004' },
];

export interface GenerateSamplesOptions {
  readonly keyFile: string;
  readonly outDir: string;
  readonly trustedKeysFile: string;
  /** A ready hasher. When absent, a single-thread WASM Barretenberg is created and destroyed. */
  readonly hasher?: Hasher;
}

interface DemoKey {
  readonly privateKey: CryptoKey;
  readonly publicHex: string;
  readonly sourceKeyId: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

/**
 * Reads and validates the Demo_Key JWK (kty OKP, crv Ed25519, `x` and `d` as 43 base64url
 * characters), imports it for signing and derives the public key and the source key id.
 * Any failure throws `Error('DEMO KEY FILE UNUSABLE')` with no detail. Never creates a key.
 */
async function loadDemoKey(keyFile: string): Promise<DemoKey> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(keyFile, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(KEY_UNUSABLE);
    const jwk = parsed as Record<string, unknown>; // checked to be a non-null, non-array object just above
    const { kty, crv, x, d } = jwk;
    if (kty !== 'OKP' || crv !== 'Ed25519') throw new Error(KEY_UNUSABLE);
    if (typeof x !== 'string' || typeof d !== 'string') throw new Error(KEY_UNUSABLE);
    if (!BASE64URL_32_BYTES.test(x) || !BASE64URL_32_BYTES.test(d)) throw new Error(KEY_UNUSABLE);
    const publicBytes = Buffer.from(x, 'base64url');
    if (publicBytes.length !== 32) throw new Error(KEY_UNUSABLE);
    const privateKey = await crypto.subtle.importKey('jwk', { kty, crv, x, d }, 'Ed25519', false, ['sign']);
    const publicHex = publicBytes.toString('hex');
    const sourceKeyId = `DEMO-${createHash('sha256').update(publicBytes).digest('hex').slice(0, 16)}`;
    return { privateKey, publicHex, sourceKeyId };
  } catch {
    throw new Error(KEY_UNUSABLE);
  }
}

/** The text of the generated `trusted-keys.ts`: one demo public key, final LF. */
function trustedKeysText(key: DemoKey): string {
  return (
    '// GENERATED by scripts/gen-samples.ts. DEMO public key only. Do not edit.\n' +
    'export const TRUSTED_SOURCE_KEYS: Readonly<Record<string, string>> = ' +
    `Object.freeze({ '${key.sourceKeyId}': '${key.publicHex}' });\n`
  );
}

interface BuiltSample {
  readonly spec: SampleSpec;
  readonly datText: string;
  readonly digestText: string;
}

async function buildSample(hasher: Hasher, key: DemoKey, spec: SampleSpec): Promise<BuiltSample> {
  const batch = generateBatch({ kind: spec.kind, seed: spec.seed, count: spec.count, batchId: spec.batchId });
  const datText = serializeBatch(batch);
  const root = await batchRoot(hasher, batch);
  const message = new Uint8Array(digestMessage(spec.batchId, root, spec.count));
  const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', key.privateKey, message));
  // Key order is part of the format (design "Digest").
  const digest: SignedDigest = {
    batchId: spec.batchId,
    merkleRoot: `0x${root.toString(16).padStart(64, '0')}`,
    recordCount: spec.count,
    signature: bytesToHex(signature),
    sourceKeyId: key.sourceKeyId,
  };
  // Catches an `x` that does not belong to `d`, before any file is written.
  if (!(await verifyDigest(digest, key.publicHex))) throw new Error(SELF_CHECK_FAILED);
  return { spec, datText, digestText: `${JSON.stringify(digest, null, 2)}\n` };
}

/** Creates the single-thread WASM hasher (as `tests/support/zk-env.ts` does) and its cleanup. */
async function createOwnHasher(): Promise<{ readonly hasher: Hasher; readonly destroy: () => Promise<void> }> {
  const { Barretenberg, BackendType } = await import('@aztec-foundation/bb.js');
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
  return { hasher: createHasher(api), destroy: () => api.destroy() };
}

/**
 * Generates and signs the four samples and writes them with `trusted-keys.ts`. Returns the stdout
 * lines (`<file name> <record count>` per sample file, then `trusted-keys.ts`).
 */
export async function generateSamples(options: GenerateSamplesOptions): Promise<readonly string[]> {
  const key = await loadDemoKey(options.keyFile);
  const own = options.hasher === undefined ? await createOwnHasher() : undefined;
  const hasher = options.hasher ?? own?.hasher;
  if (hasher === undefined) throw new Error(GENERATION_FAILED);
  const built: BuiltSample[] = [];
  try {
    for (const spec of SAMPLES) {
      built.push(await buildSample(hasher, key, spec));
    }
  } finally {
    await own?.destroy();
  }
  // Everything is computed and checked. Only now are files written.
  const lines: string[] = [];
  mkdirSync(options.outDir, { recursive: true });
  for (const { spec, datText, digestText } of built) {
    writeFileSync(resolve(options.outDir, `${spec.name}.dat`), datText);
    lines.push(`${spec.name}.dat ${spec.count}`);
    writeFileSync(resolve(options.outDir, `${spec.name}.digest.json`), digestText);
    lines.push(`${spec.name}.digest.json ${spec.count}`);
  }
  writeFileSync(options.trustedKeysFile, trustedKeysText(key));
  lines.push(TRUSTED_KEYS_NAME);
  return lines;
}

/** Parses `--key-file`, `--out-dir` and `--trusted-keys-file`, each with one value. */
function parseArguments(args: readonly string[]): GenerateSamplesOptions {
  let keyFile = DEFAULT_KEY_FILE;
  let outDir = DEFAULT_OUT_DIR;
  let trustedKeysFile = DEFAULT_TRUSTED_KEYS_FILE;
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (value === undefined || value === '') throw new Error(ARGUMENTS_INVALID);
    const path = resolve(value);
    if (flag === '--key-file') keyFile = path;
    else if (flag === '--out-dir') outDir = path;
    else if (flag === '--trusted-keys-file') trustedKeysFile = path;
    else throw new Error(ARGUMENTS_INVALID);
  }
  return { keyFile, outDir, trustedKeysFile };
}

/** The command-line wrapper. Returns the exit status. Error lines are fixed messages only. */
async function main(args: readonly string[]): Promise<number> {
  try {
    const lines = await generateSamples(parseArguments(args));
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  } catch (error) {
    const known = [KEY_UNUSABLE, SELF_CHECK_FAILED, ARGUMENTS_INVALID];
    const message = error instanceof Error && known.includes(error.message) ? error.message : GENERATION_FAILED;
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}

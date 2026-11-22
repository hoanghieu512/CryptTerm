// Identity_Script (zk-core Requirement 7, design section D).
//
// Builds the circuit identity from the committed Artifact and its meta file, and nothing else:
//   - the verification key, from `circuitComputeVk` with PROOF_SETTINGS (no proof is made),
//   - VK_HASH, the SHA-256 of those key bytes as 64 lowercase hex characters,
//   - CIRCUIT_VERSION, `nargo-<version>+` and the first 32 hex characters of the Artifact sha256.
// It writes `ledger_audit.vk` and the generated `circuit-identity.ts`, both built in memory first
// and written last through a temporary file and a rename.
//
// Run: `npm run gen:identity`, after `npm run build:circuit`. Output lines hold file names and
// the two public values only. A failure writes `CIRCUIT IDENTITY FAILED: <STEP>` and exits 1.
// This script never imports `src/zk/artifact.ts`, whose `?url` import does not run in Node.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROOF_SETTINGS, acirBytes, createBb } from '../src/zk/prover';
import { sha256Hex } from '../src/zk/sha256';
import { loadSrs, parseSrsManifest } from '../src/zk/srs';
import type { SrsBytes } from '../src/zk/srs';

const STEPS = ['ARGUMENTS', 'ARTIFACT', 'META', 'ARTIFACT HASH', 'SRS', 'VK', 'WRITE'] as const;
export type IdentityStep = (typeof STEPS)[number];

/** A failed step. The message is fixed and names the step, never a value. */
export class IdentityError extends Error {
  readonly step: IdentityStep;
  constructor(step: IdentityStep) {
    super(`CIRCUIT IDENTITY FAILED: ${step}`);
    this.name = 'IdentityError';
    this.step = step;
  }
}

/** Where the two outputs go: one folder for both, or one folder for each. */
export type OutputDirs = string | { readonly vkDir: string; readonly identityDir: string };

export interface IdentityOptions {
  readonly artifactPath: string;
  readonly metaPath: string;
  readonly srsDir: string;
  readonly outDir: OutputDirs;
}

export interface IdentityResult {
  readonly circuitVersion: string;
  readonly vkHash: string;
  readonly vkByteLength: number;
}

const VK_FILE = 'ledger_audit.vk';
const IDENTITY_FILE = 'circuit-identity.ts';
const SHA256_HEX = /^[0-9a-f]{64}$/;
const NARGO_VERSION_LINE = /^nargo version = (\d+\.\d+\.\d+)$/;

/** Reads a file or fails with the named step. The cause is dropped, so no path leaks. */
function readOrFail(path: string, step: IdentityStep): Buffer {
  try {
    return readFileSync(path);
  } catch {
    throw new IdentityError(step);
  }
}

interface Meta {
  readonly nargoVersion: string;
  readonly artifactSha256: string;
}

/** The two meta fields as `ledger_audit.meta.json` writes them. Anything else is step META. */
function parseMeta(text: string): Meta {
  let record: Record<string, unknown> | null;
  try {
    record = JSON.parse(text) as Record<string, unknown> | null;
  } catch {
    throw new IdentityError('META');
  }
  const line = record?.['nargoVersion'];
  const sha = record?.['artifactSha256'];
  const version = typeof line === 'string' ? NARGO_VERSION_LINE.exec(line)?.[1] : undefined;
  if (version === undefined || typeof sha !== 'string' || !SHA256_HEX.test(sha)) {
    throw new IdentityError('META');
  }
  return { nargoVersion: version, artifactSha256: sha };
}

// The SRS from `srsDir`, checked against its manifest by `loadSrs`. Any failure is step SRS.
async function readSrs(srsDir: string): Promise<SrsBytes> {
  const file = (name: string): Uint8Array => new Uint8Array(readFileSync(join(srsDir, name)));
  try {
    const manifest = parseSrsManifest(JSON.parse(readFileSync(join(srsDir, 'srs.sha256.json'), 'utf8')));
    return await loadSrs(
      { readG1: () => Promise.resolve(file('g1.dat')), readG2: () => Promise.resolve(file('g2.dat')) },
      manifest,
    );
  } catch {
    throw new IdentityError('SRS');
  }
}

// The verification key bytes: the Artifact bytecode through `circuitComputeVk`, no proof. The
// prover instance is destroyed whatever happens. Any failure is step VK.
async function computeVk(artifactBytes: Buffer, srs: SrsBytes): Promise<Uint8Array> {
  try {
    const artifact = JSON.parse(artifactBytes.toString('utf8')) as { bytecode?: unknown };
    if (typeof artifact.bytecode !== 'string') throw new Error('no bytecode');
    const acir = await acirBytes({ bytecode: artifact.bytecode });
    const api = await createBb(srs);
    try {
      const request = { circuit: { name: 'ledger_audit', bytecode: acir }, settings: PROOF_SETTINGS };
      return (await api.circuitComputeVk(request)).bytes;
    } finally {
      await api.destroy();
    }
  } catch {
    throw new IdentityError('VK');
  }
}

// The text of the generated `src/zk/circuit-identity.ts`. The format is fixed: a header line,
// three constants and a final line feed. `scripts/check-dist-vk` reads VK_HASH from it.
function identityFileText(circuitVersion: string, vkHash: string, vkByteLength: number): string {
  return [
    '// GENERATED by scripts/gen-circuit-identity.ts. Do not edit.',
    '// Source: src/zk/artifacts/ledger_audit.json and ledger_audit.meta.json. Public values only.',
    `export const CIRCUIT_VERSION = '${circuitVersion}';`,
    `export const VK_HASH = '${vkHash}';`,
    `export const VK_BYTE_LENGTH = ${vkByteLength};`,
    '',
  ].join('\n');
}

interface PendingFile {
  readonly dir: string;
  readonly name: string;
  readonly content: string | Uint8Array;
}

// Writes every file to a temporary name first, then renames them all. A failure removes the
// temporary files and is step WRITE.
function writeAll(files: readonly PendingFile[]): void {
  const temporary = files.map((f) => ({ ...f, tmp: join(f.dir, `${f.name}.tmp-${process.pid}`) }));
  try {
    for (const f of temporary) {
      mkdirSync(f.dir, { recursive: true });
      writeFileSync(f.tmp, f.content);
    }
    for (const f of temporary) {
      renameSync(f.tmp, join(f.dir, f.name));
    }
  } catch {
    for (const f of temporary) rmSync(f.tmp, { force: true });
    throw new IdentityError('WRITE');
  }
}

// Steps in order: ARTIFACT, META, ARTIFACT HASH, SRS, VK, WRITE. The first failure stops the run,
// and nothing is written before the last step.
export async function generateIdentity(options: IdentityOptions): Promise<IdentityResult> {
  const artifactBytes = readOrFail(options.artifactPath, 'ARTIFACT');
  const meta = parseMeta(readOrFail(options.metaPath, 'META').toString('utf8'));
  const artifactSha = await sha256Hex(artifactBytes);
  if (artifactSha !== meta.artifactSha256) throw new IdentityError('ARTIFACT HASH');
  const vk = await computeVk(artifactBytes, await readSrs(options.srsDir));
  const circuitVersion = `nargo-${meta.nargoVersion}+${artifactSha.slice(0, 32)}`;
  const vkHash = await sha256Hex(vk);
  const single = typeof options.outDir === 'string';
  const dirs = single ? { vkDir: options.outDir, identityDir: options.outDir } : options.outDir;
  const identityText = identityFileText(circuitVersion, vkHash, vk.length);
  writeAll([
    { dir: dirs.vkDir, name: VK_FILE, content: vk },
    { dir: dirs.identityDir, name: IDENTITY_FILE, content: identityText },
  ]);
  return { circuitVersion, vkHash, vkByteLength: vk.length };
}

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const ZK_DIR = resolve(REPO_ROOT, 'src', 'zk');
const ARTIFACTS_DIR = join(ZK_DIR, 'artifacts');
const OPTION_NAMES = ['--artifact', '--meta', '--srs', '--out'];

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

// Each option takes one value. `--out` sends both files to one folder. Without it the key goes to
// `src/zk/artifacts` and the identity file to `src/zk`.
function parseArgs(args: readonly string[]): IdentityOptions {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (name === undefined || value === undefined || !OPTION_NAMES.includes(name)) {
      throw new IdentityError('ARGUMENTS');
    }
    values.set(name, resolve(value));
  }
  return {
    artifactPath: values.get('--artifact') ?? join(ARTIFACTS_DIR, 'ledger_audit.json'),
    metaPath: values.get('--meta') ?? join(ARTIFACTS_DIR, 'ledger_audit.meta.json'),
    srsDir: values.get('--srs') ?? join(ARTIFACTS_DIR, 'srs'),
    outDir: values.get('--out') ?? { vkDir: ARTIFACTS_DIR, identityDir: ZK_DIR },
  };
}

/** Runs the script. Returns the exit status: 0 on success, 1 on any failure. */
export async function runCli(args: readonly string[], io: CliIo): Promise<number> {
  try {
    const result = await generateIdentity(parseArgs(args));
    io.out(`WROTE ${VK_FILE}`);
    io.out(`WROTE ${IDENTITY_FILE}`);
    io.out(`CIRCUIT_VERSION ${result.circuitVersion}`);
    io.out(`VK_HASH ${result.vkHash}`);
    return 0;
  } catch (error) {
    // Only the fixed step line is printed. Any other error is reported as the VK step.
    io.err(error instanceof IdentityError ? error.message : 'CIRCUIT IDENTITY FAILED: VK');
    return 1;
  }
}

const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url) {
  const write = (stream: NodeJS.WriteStream) => (line: string) => void stream.write(`${line}\n`);
  process.exitCode = await runCli(process.argv.slice(2), { out: write(process.stdout), err: write(process.stderr) });
}

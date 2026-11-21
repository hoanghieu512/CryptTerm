// Independent re-verification of the vendored SRS (Requirement 14.4).
//
// DEVELOPER SCRIPT. It uses the network; the app never does. It downloads only
// public ceremony data, keeps every download in memory and writes no file.
//
// Run from the repository root:   node scripts/verify-srs.ts
// Optional:                       node scripts/verify-srs.ts --dir <path>
//   `--dir` reads srs.sha256.json, g1.dat and g2.dat from <path> instead of
//   src/zk/artifacts/srs/. It exists so a copy with one flipped byte (made in a
//   temp directory outside the repo) can show that the script fails.
//
// Node 24 strips the types, so there is no build step. Erasable syntax only
// (no enums, namespaces or parameter properties), and no import of repo files.
//
// Checks:
//   1. Mirror check. The same `bytes=0-<END>` range of g1.dat and the whole
//      g2.dat from the manifest's mirror host are compared with the committed
//      files, byte for byte and by sha256.
//   2. Chunk check. ceil(pointCount / 131072) whole 4 MiB chunks of
//      g1_compressed.dat come from the primary host. bb.js `srsInitSrs` checks
//      each chunk against the SHA-256 pinned in its binary and returns the
//      decompressed points, whose first pointCount * 64 bytes are compared with
//      the committed g1.dat.
//
// Output: one `PASS ...` or `FAIL ...` line per check, nothing else. Exit status
// 0 only when every check passed, 1 otherwise.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BackendType, Barretenberg } from '@aztec-foundation/bb.js';

const PRIMARY_ORIGIN = 'https://crs.aztec-cdn.foundation';
const MIRROR_ORIGIN = 'https://crs.aztec-labs.com';
const COMPRESSED_URL = `${PRIMARY_ORIGIN}/g1_compressed.dat`;
const CHUNK_POINTS = 131072; // one pinned bb.js chunk
const COMPRESSED_BYTES_PER_POINT = 32;
const CHUNK_BYTES = CHUNK_POINTS * COMPRESSED_BYTES_PER_POINT; // 4194304
const TIMEOUT_MS = 120_000;
const G2_BYTES = 128;
const FORMAT = 'bn254-g1-uncompressed-be64';
const BYTES_PER_POINT = 64;
const SHA256_HEX = /^[0-9a-f]{64}$/;

class CheckFailure extends Error {}

interface FileEntry {
  readonly bytes: number;
  readonly sha256: string;
  readonly mirror: string;
}

interface Manifest {
  readonly pointCount: number;
  readonly g1: FileEntry;
  readonly g2: FileEntry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(reason: string): never {
  throw new CheckFailure(reason);
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function describe(error: unknown): string {
  if (error instanceof CheckFailure) return oneLine(error.message);
  if (error instanceof Error) return oneLine(`${error.name}: ${error.message}`);
  return 'UNKNOWN ERROR';
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseEntry(value: unknown, name: string): FileEntry {
  if (!isRecord(value)) fail(`MANIFEST INVALID: ${name}`);
  const { bytes, sha256, mirror } = value;
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) {
    fail(`MANIFEST INVALID: ${name}.bytes`);
  }
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) {
    fail(`MANIFEST INVALID: ${name}.sha256`);
  }
  if (typeof mirror !== 'string') fail(`MANIFEST INVALID: ${name}.mirror`);
  return { bytes, sha256, mirror };
}

function parseManifest(text: string): Manifest {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('MANIFEST NOT JSON');
  }
  if (!isRecord(json)) return fail('MANIFEST INVALID: manifest');
  const { format, pointCount, bytesPerPoint, files } = json;
  if (format !== FORMAT) fail('MANIFEST INVALID: format');
  if (typeof pointCount !== 'number' || !Number.isSafeInteger(pointCount) || pointCount <= 0) {
    fail('MANIFEST INVALID: pointCount');
  }
  if (bytesPerPoint !== BYTES_PER_POINT) fail('MANIFEST INVALID: bytesPerPoint');
  if (!isRecord(files)) return fail('MANIFEST INVALID: files');
  const g1 = parseEntry(files['g1.dat'], 'g1.dat');
  const g2 = parseEntry(files['g2.dat'], 'g2.dat');
  if (g1.bytes !== pointCount * bytesPerPoint) fail('MANIFEST INVALID: g1.dat.bytes');
  if (g2.bytes !== G2_BYTES) fail('MANIFEST INVALID: g2.dat.bytes');
  return { pointCount, g1, g2 };
}

/** Throws unless the URL is `https://` on exactly the expected origin. */
function requireOrigin(url: string, origin: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail(`${label} URL INVALID`);
  }
  if (parsed.origin !== origin) fail(`${label} URL NOT ${origin}`);
}

/** Reads at most `limit` bytes of the body. Cancels the stream when more arrive. */
async function readAtMost(response: Response, limit: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (reader === undefined) return fail('RESPONSE HAS NO BODY');
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return fail(`RESPONSE LONGER THAN ${limit} BYTES`);
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/**
 * GET with an optional Range. With a range, only HTTP 206 and a Content-Range
 * starting `bytes 0-<last>/` are accepted; a 200 is refused and its body is
 * never read. Returns exactly `length` bytes or throws.
 */
async function download(url: string, length: number, ranged: boolean): Promise<Uint8Array> {
  const headers: Record<string, string> = ranged ? { Range: `bytes=0-${length - 1}` } : {};
  const response = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (ranged) {
    if (response.status !== 206) {
      await response.body?.cancel();
      return fail(`HTTP ${response.status} TO RANGE REQUEST, EXPECTED 206`);
    }
    const contentRange = response.headers.get('content-range') ?? '';
    if (!contentRange.startsWith(`bytes 0-${length - 1}/`)) {
      await response.body?.cancel();
      return fail('CONTENT-RANGE NOT bytes 0-END');
    }
  } else if (response.status !== 200) {
    await response.body?.cancel();
    return fail(`HTTP ${response.status}, EXPECTED 200`);
  }
  const declared = response.headers.get('content-length');
  if (declared !== null && declared !== String(length)) {
    await response.body?.cancel();
    return fail(`CONTENT-LENGTH ${oneLine(declared)}, EXPECTED ${length}`);
  }
  const bytes = await readAtMost(response, length);
  if (bytes.length !== length) fail(`RECEIVED ${bytes.length} BYTES, EXPECTED ${length}`);
  return bytes;
}

function requireEqual(remote: Uint8Array, local: Uint8Array, what: string): void {
  if (remote.length !== local.length) {
    fail(`${what} LENGTH ${remote.length}, EXPECTED ${local.length}`);
  }
  for (let i = 0; i < local.length; i++) {
    if (remote[i] !== local[i]) fail(`${what} BYTE MISMATCH AT OFFSET ${i}`);
  }
}

/** The committed file must agree with the manifest before it is used as the reference. */
function requireLocal(bytes: Uint8Array, entry: FileEntry): void {
  if (bytes.length !== entry.bytes) fail(`LOCAL LENGTH ${bytes.length}, MANIFEST ${entry.bytes}`);
  if (sha256Hex(bytes) !== entry.sha256) fail('LOCAL SHA256 DIFFERS FROM MANIFEST');
}

async function mirrorCheck(name: string, entry: FileEntry, local: Uint8Array, ranged: boolean) {
  requireLocal(local, entry);
  requireOrigin(entry.mirror, MIRROR_ORIGIN, 'MIRROR');
  const remote = await download(entry.mirror, entry.bytes, ranged);
  requireEqual(remote, local, 'MIRROR');
  if (sha256Hex(remote) !== entry.sha256) fail('MIRROR SHA256 DIFFERS FROM MANIFEST');
  return `${name} ${local.length} bytes`;
}

async function chunkCheck(manifest: Manifest, g1: Uint8Array, g2: Uint8Array) {
  const chunks = Math.ceil(manifest.pointCount / CHUNK_POINTS);
  const compressedBytes = chunks * CHUNK_BYTES;
  const numPoints = chunks * CHUNK_POINTS;
  const compressed = await download(COMPRESSED_URL, compressedBytes, true);
  let api: Barretenberg | undefined;
  try {
    api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
    // bb.js hashes each whole 4 MiB chunk against its pinned hash and throws on a
    // mismatch. The response holds the decompressed 64-byte points.
    const response = await api.srsInitSrs({ pointsBuf: compressed, numPoints, g2Point: g2 });
    const decompressed = response.pointsBuf;
    if (decompressed.length < g1.length) {
      fail(`BB.JS RETURNED ${decompressed.length} BYTES, NEEDED ${g1.length}`);
    }
    requireEqual(decompressed.subarray(0, g1.length), g1, 'DECOMPRESSED');
  } finally {
    await api?.destroy();
  }
  return `g1.dat chunk-check ${compressedBytes} bytes compressed`;
}

async function run(label: string, check: () => Promise<string>): Promise<boolean> {
  try {
    console.log(`PASS ${await check()}`);
    return true;
  } catch (error) {
    console.log(`FAIL ${label} ${describe(error)}`);
    return false;
  }
}

function srsDirectory(): string {
  const index = process.argv.indexOf('--dir');
  if (index === -1) return fileURLToPath(new URL('../src/zk/artifacts/srs/', import.meta.url));
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) fail('--dir NEEDS A PATH');
  return resolve(value);
}

async function main(): Promise<boolean> {
  let manifest: Manifest;
  let g1: Uint8Array;
  let g2: Uint8Array;
  try {
    const dir = srsDirectory();
    manifest = parseManifest(readFileSync(resolve(dir, 'srs.sha256.json'), 'utf8'));
    g1 = readFileSync(resolve(dir, 'g1.dat'));
    g2 = readFileSync(resolve(dir, 'g2.dat'));
  } catch (error) {
    console.error(`FAIL manifest ${describe(error)}`);
    return false;
  }
  const results = [
    await run('g1.dat', () => mirrorCheck('g1.dat', manifest.g1, g1, true)),
    await run('g2.dat', () => mirrorCheck('g2.dat', manifest.g2, g2, false)),
    await run('g1.dat chunk-check', () => chunkCheck(manifest, g1, g2)),
  ];
  return results.every(Boolean);
}

process.exitCode = (await main()) ? 0 : 1;

// Structured reference string (SRS) loading for the in-browser prover.
//
// The SRS is a vendored, public ceremony prefix (no private data). This module
// reads it through an abstract source, checks length and SHA-256 against the
// committed manifest, and hands it to bb.js through `srsInitSrs`. No point count
// and no byte size is hard-coded here: they all come from the manifest.
//
// This module imports nothing at runtime, so it works in tests and in the worker
// without pulling the prover into its import graph.

/** One data file listed in the manifest. */
export interface SrsFileEntry {
  readonly bytes: number;
  readonly sha256: string;
  readonly source: string;
  readonly mirror: string;
  readonly byteRange: string | null;
}

/** The committed `srs.sha256.json`. */
export interface SrsManifest {
  readonly format: string;
  readonly pointCount: number;
  readonly bytesPerPoint: number;
  readonly files: {
    readonly 'g1.dat': SrsFileEntry;
    readonly 'g2.dat': SrsFileEntry;
  };
}

/** Where the raw SRS bytes come from (fetch in the worker, files in tests). */
export interface SrsSource {
  readG1(): Promise<Uint8Array>;
  readG2(): Promise<Uint8Array>;
}

/** SRS bytes that passed the manifest checks. */
export interface SrsBytes {
  readonly g1: Uint8Array;
  readonly g2: Uint8Array;
  readonly pointCount: number;
}

export type SrsErrorCode = 'SRS_FETCH' | 'SRS_HASH';

/** Coded SRS failure. The message names the file and the code, never bytes. */
export class SrsError extends Error {
  readonly code: SrsErrorCode;

  constructor(code: SrsErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SrsError';
    this.code = code;
  }
}

/** The part of the bb.js request that `initSrs` fills (`SrsInitSrs`, bb.js 6.0.0). */
export interface SrsInitSrsRequest {
  pointsBuf: Uint8Array;
  numPoints: number;
  g2Point: Uint8Array;
}

/**
 * The part of the bb.js `Barretenberg` API that `initSrs` needs. A real
 * `Barretenberg` instance satisfies it structurally.
 */
export interface SrsInitApi {
  srsInitSrs(command: SrsInitSrsRequest): Promise<unknown>;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidManifest(field: string): SrsError {
  return new SrsError('SRS_HASH', `SRS MANIFEST INVALID: ${field}`);
}

function parseFileEntry(value: unknown, name: string): SrsFileEntry {
  if (!isRecord(value)) throw invalidManifest(name);
  const { bytes, sha256, source, mirror, byteRange } = value;
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw invalidManifest(`${name}.bytes`);
  }
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) {
    throw invalidManifest(`${name}.sha256`);
  }
  if (typeof source !== 'string') throw invalidManifest(`${name}.source`);
  if (typeof mirror !== 'string') throw invalidManifest(`${name}.mirror`);
  if (typeof byteRange !== 'string' && byteRange !== null) {
    throw invalidManifest(`${name}.byteRange`);
  }
  return { bytes, sha256, source, mirror, byteRange };
}

/** Runtime shape check for the manifest JSON. Throws `SRS_HASH` when it is malformed. */
export function parseSrsManifest(value: unknown): SrsManifest {
  if (!isRecord(value)) throw invalidManifest('manifest');
  const { format, pointCount, bytesPerPoint, files } = value;
  if (typeof format !== 'string') throw invalidManifest('format');
  if (typeof pointCount !== 'number' || !Number.isSafeInteger(pointCount) || pointCount <= 0) {
    throw invalidManifest('pointCount');
  }
  if (
    typeof bytesPerPoint !== 'number' ||
    !Number.isSafeInteger(bytesPerPoint) ||
    bytesPerPoint <= 0
  ) {
    throw invalidManifest('bytesPerPoint');
  }
  if (!isRecord(files)) throw invalidManifest('files');
  return {
    format,
    pointCount,
    bytesPerPoint,
    files: {
      'g1.dat': parseFileEntry(files['g1.dat'], 'g1.dat'),
      'g2.dat': parseFileEntry(files['g2.dat'], 'g2.dat'),
    },
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // `digest` accepts only ArrayBuffer-backed views in the TS lib types; the copy
  // (a 2 MiB memcpy at most) narrows `Uint8Array<ArrayBufferLike>` without a cast.
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)));
  let hex = '';
  for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

async function readChecked(
  read: () => Promise<Uint8Array>,
  name: 'g1.dat' | 'g2.dat',
  entry: SrsFileEntry,
  expectedBytes: number,
): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = await read();
  } catch (cause) {
    if (cause instanceof SrsError && cause.code === 'SRS_FETCH') throw cause;
    throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`, { cause });
  }
  if (!(bytes instanceof Uint8Array)) {
    throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`);
  }
  if (bytes.length !== entry.bytes || bytes.length !== expectedBytes) {
    throw new SrsError('SRS_HASH', `SRS LENGTH MISMATCH: ${name}`);
  }
  if ((await sha256Hex(bytes)) !== entry.sha256) {
    throw new SrsError('SRS_HASH', `SRS HASH MISMATCH: ${name}`);
  }
  return bytes;
}

/**
 * Reads both SRS files and checks them against the manifest.
 *
 * Throws `SrsError` with code `SRS_FETCH` when a read fails, and `SRS_HASH` when
 * a length or a SHA-256 differs or the manifest is malformed.
 */
export async function loadSrs(source: SrsSource, manifest: SrsManifest): Promise<SrsBytes> {
  const checked = parseSrsManifest(manifest);
  const g1Entry = checked.files['g1.dat'];
  const g2Entry = checked.files['g2.dat'];
  const g1Expected = checked.pointCount * checked.bytesPerPoint;
  if (!Number.isSafeInteger(g1Expected) || g1Expected !== g1Entry.bytes) {
    throw new SrsError('SRS_HASH', 'SRS LENGTH MISMATCH: g1.dat');
  }
  const g1 = await readChecked(() => source.readG1(), 'g1.dat', g1Entry, g1Expected);
  const g2 = await readChecked(() => source.readG2(), 'g2.dat', g2Entry, g2Entry.bytes);
  return { g1, g2, pointCount: checked.pointCount };
}

/**
 * Supplies the SRS to bb.js. The prover must have been created with
 * `skipSrsInit: true`. Passes exactly `pointCount * bytesPerPoint` bytes of G1
 * (`g1.length`, a whole multiple of `pointCount`), as bb.js derives the point
 * format from `pointsBuf.length / numPoints`.
 */
export async function initSrs(api: SrsInitApi, srs: SrsBytes): Promise<void> {
  if (
    !Number.isSafeInteger(srs.pointCount) ||
    srs.pointCount <= 0 ||
    srs.g1.length === 0 ||
    srs.g1.length % srs.pointCount !== 0
  ) {
    throw new SrsError('SRS_HASH', 'SRS LENGTH MISMATCH: g1.dat');
  }
  await api.srsInitSrs({ pointsBuf: srs.g1, numPoints: srs.pointCount, g2Point: srs.g2 });
}

async function fetchBytes(url: string, name: 'g1.dat' | 'g2.dat'): Promise<Uint8Array> {
  // Same-origin only (Requirement 14.7) when a page or worker location exists.
  // Node has no `location`, so any URL is accepted there.
  const location = (globalThis as { location?: { origin?: string; href?: string } }).location;
  if (location?.origin !== undefined) {
    let target: URL;
    try {
      target = new URL(url, location.href ?? location.origin);
    } catch (cause) {
      throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`, { cause });
    }
    if (target.origin !== location.origin) {
      throw new SrsError('SRS_FETCH', `SRS FETCH REFUSED, NOT SAME ORIGIN: ${name}`);
    }
  }
  let response: Response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (cause) {
    throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`, { cause });
  }
  if (!response.ok) {
    throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`);
  }
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch (cause) {
    throw new SrsError('SRS_FETCH', `SRS FETCH FAILED: ${name}`, { cause });
  }
}

/**
 * Builds an `SrsSource` that reads the two SRS files with plain GET requests
 * (no body, default credentials). When `globalThis.location` exists (page or
 * worker), a URL whose origin differs from `location.origin` is refused with
 * `SRS_FETCH`. Without a location (Node) any URL is accepted.
 */
export function fetchSrsSource(urls: { readonly g1: string; readonly g2: string }): SrsSource {
  return {
    readG1: () => fetchBytes(urls.g1, 'g1.dat'),
    readG2: () => fetchBytes(urls.g2, 'g2.dat'),
  };
}

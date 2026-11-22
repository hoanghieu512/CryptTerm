// Test environments for `noir_js` and `bb.js` in Node (Requirements 6.1, 1.9, 1.10).
//
// Four factories (the fourth, createNodeBackend, wraps createProverEnv for the full-proof tests):
//   createNoirEnv()    loads the committed Artifact from disk and creates `Noir`. No WASM setup is
//                      needed in Node: the `nodejs` builds of `acvm_js` and `noirc_abi` initialise
//                      themselves and `Noir.init()` is a no-op there (see docs/spike-results.md, T6.3-a).
//   createHasherEnv()  a single-thread WASM `Barretenberg` for `poseidon2Hash`. `skipSrsInit: true`
//                      and no `srsInitSrs` (U19, see T6.3-c).
//   createProverEnv()  the same, plus the vendored SRS prefix read from disk and passed to
//                      `srsInitSrs`. ONLY files under `tests/zk/proof/` and `createNodeBackend` below use it.
//
// Rules for callers:
//   - Every file that creates a `Barretenberg` registers `destroy()` in `afterAll`.
//   - No factory makes a network request: `skipSrsInit: true` always, and the SRS comes from
//     `src/zk/artifacts/srs/` through `node:fs`.
//   - Nothing here reads or prints batch data.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BackendType, Barretenberg } from '@aztec-foundation/bb.js';
import { Noir } from '@noir-lang/noir_js';
import type { CompiledCircuit } from '@noir-lang/types';
import { assertShippedVk } from '../../src/zk/circuit-vk';
import { createHasher } from '../../src/zk/hash';
import type { Hasher } from '../../src/zk/hash';
import { acirBytes, executeCircuit, proveCircuit, verifyProofWithVk } from '../../src/zk/prover';
import { initSrs, loadSrs, parseSrsManifest } from '../../src/zk/srs';
import type { SrsBytes, SrsSource } from '../../src/zk/srs';
import type { WorkerBackend } from '../../src/zk/worker-core';

const ARTIFACT_PATH = fileURLToPath(
  new URL('../../src/zk/artifacts/ledger_audit.json', import.meta.url),
);
const SRS_DIR = new URL('../../src/zk/artifacts/srs/', import.meta.url);
const SRS_MANIFEST_PATH = fileURLToPath(new URL('srs.sha256.json', SRS_DIR));
const SRS_G1_PATH = fileURLToPath(new URL('g1.dat', SRS_DIR));
const SRS_G2_PATH = fileURLToPath(new URL('g2.dat', SRS_DIR));
const VK_PATH = fileURLToPath(new URL('../../src/zk/artifacts/ledger_audit.vk', import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks the fields `CompiledCircuit` (`@noir-lang/types` 1.0.0) requires and narrows the parsed
 * JSON. The inner shape of `abi`, `debug_symbols` and `file_map` is checked by `noir_js` itself
 * when it encodes inputs, so only the top level is asserted here.
 */
function assertCompiledCircuit(value: unknown): asserts value is CompiledCircuit {
  if (!isRecord(value)) throw new Error('ARTIFACT INVALID: not an object');
  if (typeof value['bytecode'] !== 'string' || value['bytecode'].length === 0) {
    throw new Error('ARTIFACT INVALID: bytecode');
  }
  if (!isRecord(value['abi'])) throw new Error('ARTIFACT INVALID: abi');
  if (typeof value['debug_symbols'] !== 'string') throw new Error('ARTIFACT INVALID: debug_symbols');
  if (!isRecord(value['file_map'])) throw new Error('ARTIFACT INVALID: file_map');
}

export interface NoirEnv {
  readonly noir: Noir;
  readonly artifact: CompiledCircuit;
}

/** Loads `src/zk/artifacts/ledger_audit.json` from disk and creates `Noir`. Nothing to destroy. */
export function createNoirEnv(): NoirEnv {
  const parsed: unknown = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
  assertCompiledCircuit(parsed);
  return { noir: new Noir(parsed), artifact: parsed };
}

/** An `SrsSource` that reads `g1.dat` and `g2.dat` from `src/zk/artifacts/srs/` on disk. */
export function createDiskSrsSource(): SrsSource {
  return {
    readG1: () => Promise.resolve(new Uint8Array(readFileSync(SRS_G1_PATH))),
    readG2: () => Promise.resolve(new Uint8Array(readFileSync(SRS_G2_PATH))),
  };
}

export interface HasherEnv {
  readonly api: Barretenberg;
  readonly hasher: Hasher;
  /** Callers register this in `afterAll`. Safe to call more than once. */
  destroy(): Promise<void>;
}

export interface ProverEnv extends HasherEnv {
  /** The SRS bytes that were passed to `srsInitSrs` (checked against the manifest). */
  readonly srs: SrsBytes;
}

async function createApi(): Promise<Barretenberg> {
  // WASM on the calling thread, one thread, and no SRS download: the same path as the browser worker.
  return Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
}

function makeDestroy(api: Barretenberg): () => Promise<void> {
  let destroyed: Promise<void> | undefined;
  return () => {
    destroyed ??= api.destroy();
    return destroyed;
  };
}

/** Single-thread WASM `Barretenberg` with `skipSrsInit: true` and no `srsInitSrs`. */
export async function createHasherEnv(): Promise<HasherEnv> {
  const api = await createApi();
  return { api, hasher: createHasher(api), destroy: makeDestroy(api) };
}

/**
 * Like `createHasherEnv()`, and also supplies the vendored SRS prefix from disk through
 * `loadSrs` and `initSrs` in `src/zk/srs.ts`. ONLY files under `tests/zk/proof/` use this.
 */
export async function createProverEnv(): Promise<ProverEnv> {
  const api = await createApi();
  const destroy = makeDestroy(api);
  try {
    const manifest = parseSrsManifest(JSON.parse(readFileSync(SRS_MANIFEST_PATH, 'utf8')));
    const srs = await loadSrs(createDiskSrsSource(), manifest);
    await initSrs(api, srs);
    return { api, hasher: createHasher(api), destroy, srs };
  } catch (error) {
    await destroy();
    throw error;
  }
}

export interface NodeBackend extends WorkerBackend {
  /** Callers register this in `afterAll`. Safe to call more than once. */
  destroy(): Promise<void>;
}

/**
 * A `WorkerBackend` for Node that runs the real circuit and the real prover. It is the Node twin
 * of `createBrowserBackend`: one `createProverEnv` (vendored SRS from disk) shared by the prover
 * and verifier sessions, and the shipped `ledger_audit.vk` read from disk and checked with
 * `assertShippedVk` before the verifier session uses it. Session `close` does nothing, because the
 * shared `Barretenberg` is destroyed once, by `destroy()`. Used behind `createInProcessPort` by
 * the full-proof tests.
 */
export async function createNodeBackend(): Promise<NodeBackend> {
  const env = await createProverEnv();
  const { noir, artifact } = createNoirEnv();
  const acir = await acirBytes(artifact);
  return {
    openProver: () =>
      Promise.resolve({
        hasher: env.hasher,
        execute: async (inputs) => (await executeCircuit(noir, inputs)).witness,
        prove: async (witness) => {
          const { proof, publicInputs } = await proveCircuit(env.api, acir, witness);
          return { proof, publicInputs };
        },
        close: () => Promise.resolve(),
      }),
    openVerifier: async () => {
      const vk = new Uint8Array(readFileSync(VK_PATH));
      await assertShippedVk(vk);
      return {
        verify: (proof, publicInputs) => verifyProofWithVk(env.api, vk, publicInputs, proof),
        close: () => Promise.resolve(),
      };
    },
    destroy: env.destroy,
  };
}

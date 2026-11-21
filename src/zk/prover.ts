// Prover wrappers around `noir_js` and `bb.js` (Requirements 8.2, 8.12, 14.7).
//
// Single-threaded WASM, direct mode, no SharedArrayBuffer, so the page needs no COOP/COEP
// headers. The SRS bytes come from the caller (the worker fetches them from the page origin
// or a test reads them from disk). This module makes no network request and logs nothing.
//
// bb.js errors are passed through unchanged: the worker classifies them later (`too many
// points`, a missing Grumpkin SRS). Nothing here adds a value to an error message.
import { BackendType, Barretenberg } from '@aztec-foundation/bb.js';
import type { Noir } from '@noir-lang/noir_js';
import type { InputMap } from '@noir-lang/noirc_abi';
import { bytes32ToField } from '../ledger/field';
import { base64ToBytes, gunzip } from './gzip';
import { initSrs } from './srs';
import type { SrsBytes } from './srs';

/**
 * bb.js does not export `ProofSystemSettings` from its package entry, so the type is read
 * off the `circuitVerify` request (`api_types.d.ts` lines 26-31 and 50-55).
 */
export type ProofSettings = Parameters<Barretenberg['circuitVerify']>[0]['settings'];

/**
 * UltraHonk with the Poseidon2 transcript, zero-knowledge on. This equals the default that
 * `UltraHonkBackend` uses when no options are passed (bb.js 6.0.0, `backend.ts`).
 */
export const PROOF_SETTINGS = {
  ipaAccumulation: false,
  oracleHashType: 'poseidon2',
  disableZk: false,
  optimizedSolidityVerifier: false,
} as const satisfies ProofSettings;

/** Name given to the circuit in bb.js requests (a label only). */
const CIRCUIT_NAME = 'ledger_audit';

/** Bytes per proof field element in the `proof: Uint8Array[]` that `circuitProve` returns. */
const BYTES_PER_PROOF_FIELD = 32;

/**
 * Creates the single-thread WASM prover and loads the SRS from the caller's bytes.
 *
 * `skipSrsInit: true` is mandatory on every `Barretenberg.new` call. Without it bb.js would
 * download the SRS from the ceremony hosts and cache it in IndexedDB, which breaks the
 * same-origin rule (Requirement 14.7) and the vendored-SRS rule (Requirement 10.1). The SRS
 * then comes only from `srs`, through `srsInitSrs` (see `initSrs` in `srs.ts`).
 *
 * `threads: 1` with `BackendType.Wasm` is single-threaded WASM on the calling thread. It
 * needs no `SharedArrayBuffer`, so no COOP/COEP headers (Requirement 8.12).
 *
 * The caller owns the returned instance and must call `destroy()`.
 */
export async function createBb(srs: SrsBytes): Promise<Barretenberg> {
  const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
  try {
    await initSrs(api, srs);
  } catch (error) {
    await api.destroy();
    throw error;
  }
  return api;
}

/**
 * The uncompressed ACIR bytes that `circuitProve` and `circuitStats` take. The Artifact
 * `bytecode` is base64 of gzip.
 */
export async function acirBytes(artifact: { readonly bytecode: string }): Promise<Uint8Array> {
  return gunzip(base64ToBytes(artifact.bytecode));
}

/**
 * Runs the circuit in `noir_js` and returns the witness stack. `witness` is GZIPPED
 * (`compressWitnessStack` in noir_js 1.0.0), so `proveCircuit` decompresses it. A violated
 * constraint rejects with the `noir_js` error, unchanged.
 */
export async function executeCircuit(
  noir: Noir,
  inputs: InputMap,
): Promise<{ readonly witness: Uint8Array }> {
  const { witness } = await noir.execute(inputs);
  return { witness };
}

export interface ProveResult {
  /** Proof field elements, 32 bytes each. */
  readonly proof: Uint8Array[];
  /** Public input field elements, 32 bytes each, in ABI order of the public parameters. */
  readonly publicInputs: Uint8Array[];
  /** The verification key that bb.js computed during the prove call (`vk.bytes`). */
  readonly vk: Uint8Array;
  /** `32 * proof.length`. A byte count; public inputs are not included. */
  readonly proofSizeBytes: number;
}

/**
 * Proves with an EMPTY verification key (bb.js then computes and returns the key) and the
 * GUNZIPPED witness. `compressedWitness` is the `witness` that `executeCircuit` returns.
 */
export async function proveCircuit(
  api: Pick<Barretenberg, 'circuitProve'>,
  acir: Uint8Array,
  compressedWitness: Uint8Array,
): Promise<ProveResult> {
  const witness = await gunzip(compressedWitness);
  const response = await api.circuitProve({
    circuit: { name: CIRCUIT_NAME, bytecode: acir, verificationKey: new Uint8Array(0) },
    witness,
    settings: PROOF_SETTINGS,
  });
  return {
    proof: response.proof,
    publicInputs: response.publicInputs,
    vk: response.vk.bytes,
    proofSizeBytes: BYTES_PER_PROOF_FIELD * response.proof.length,
  };
}

/** Verifies a proof against a verification key. Returns bb.js' `verified` flag. */
export async function verifyProofWithVk(
  api: Pick<Barretenberg, 'circuitVerify'>,
  vk: Uint8Array,
  publicInputs: Uint8Array[],
  proof: Uint8Array[],
): Promise<boolean> {
  const response = await api.circuitVerify({
    verificationKey: vk,
    publicInputs,
    proof,
    settings: PROOF_SETTINGS,
  });
  return response.verified;
}

export interface CircuitSizes {
  readonly numGates: number;
  readonly numGatesDyadic: number;
}

/** Gate counts from `circuitStats` (no SRS is needed for this call). */
export async function circuitSizes(
  api: Pick<Barretenberg, 'circuitStats'>,
  acir: Uint8Array,
): Promise<CircuitSizes> {
  const stats = await api.circuitStats({
    circuit: { name: CIRCUIT_NAME, bytecode: acir, verificationKey: new Uint8Array(0) },
    includeGatesPerOpcode: false,
    settings: PROOF_SETTINGS,
  });
  return { numGates: stats.numGates, numGatesDyadic: stats.numGatesDyadic };
}

/**
 * Decodes public input elements (32 bytes, big-endian) into field values. For this circuit
 * the expected order is `[merkle_root, record_count, limit_cents]` (U11).
 */
export function decodePublicInputs(publicInputs: readonly Uint8Array[]): bigint[] {
  return publicInputs.map((element) => bytes32ToField(element));
}

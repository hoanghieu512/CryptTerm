// Root_Function: the Merkle root of a `Batch`, shared by the signer and the prover
// (ledger-format Requirement 5, design "Root function").
//
// This file reuses `buildCircuitInputs` and keeps no hash, padding or leaf-encoding logic of its
// own. It passes `LIMIT_CENTS` only because the builder requires a limit. The root does not depend
// on the limit, so any valid limit gives the same root.
import type { Batch } from '../ledger/batch';
import { LIMIT_CENTS } from '../ledger/invariants';
import type { Hasher } from './hash';
import { buildCircuitInputs } from './witness-builder';

/**
 * The root of `batch`, padded to 64 slots. Throws `FieldRangeError` (field and slot, never the
 * value) for a posting field out of range or for a posting count outside 1 to 64.
 */
export async function batchRoot(hasher: Hasher, batch: Batch): Promise<bigint> {
  const built = await buildCircuitInputs(hasher, { postings: batch.postings, limitCents: LIMIT_CENTS });
  return built.merkleRoot;
}

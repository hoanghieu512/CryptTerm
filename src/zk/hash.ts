// Poseidon2 hashing for leaves and inner Merkle nodes.
//
// Every hash is computed by `bb.js` `poseidon2Hash`. This file holds no Poseidon constants,
// no permutation code and no field arithmetic that computes a hash. It only encodes inputs
// as 32-byte big-endian elements and decodes the 32-byte result.
//
// The two call shapes (leaf: six inputs, node: two inputs) are the ones that equal the Noir
// sponge in `circuits/ledger_audit/src/hash.nr`. See `.kiro/steering/noir.md` "Settled choices".

import { bytes32ToField, fieldToBytes32 } from './field';

/**
 * The part of `Barretenberg` (async API, `@aztec-foundation/bb.js` 6.0.0) that hashing needs.
 * Request type `Poseidon2Hash` is `{ inputs: Uint8Array[] }`, response type
 * `Poseidon2HashResponse` is `{ hash: Uint8Array }` (`cbind/generated/api_types.d.ts`).
 * Each input and the output is a 32-byte big-endian field element.
 */
export interface Poseidon2Api {
  poseidon2Hash(request: { inputs: Uint8Array[] }): Promise<{ hash: Uint8Array }>;
}

/** The six leaf inputs in circuit order: `[record_id, account, side, amount, review_flag, salt]`. */
export type LeafFields = readonly [bigint, bigint, bigint, bigint, bigint, bigint];

export interface Hasher {
  /** Poseidon2 of six field elements (one `poseidon2Hash` call with six inputs). */
  hashLeaf(fields: LeafFields): Promise<bigint>;
  /** Poseidon2 of two field elements (one `poseidon2Hash` call with two inputs). */
  hashNode(left: bigint, right: bigint): Promise<bigint>;
}

export function createHasher(api: Poseidon2Api): Hasher {
  async function hashFields(fields: readonly bigint[]): Promise<bigint> {
    const inputs = fields.map((f) => fieldToBytes32(f));
    const { hash } = await api.poseidon2Hash({ inputs });
    return bytes32ToField(hash);
  }

  return {
    hashLeaf: (fields) => hashFields(fields),
    hashNode: (left, right) => hashFields([left, right]),
  };
}

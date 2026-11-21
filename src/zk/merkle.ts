// Merkle tree over all `CAPACITY` leaves, in the circuit's order.
//
// Leaf `i` is position `i` of level 0. Parent `j` of level `l + 1` is
// `hashNode(level_l[2j], level_l[2j + 1])`. The root is the single node of the last level.
// Layout recorded in `.kiro/steering/noir.md` "Settled choices", defined by
// `circuits/ledger_audit/src/merkle.nr`.

import { CAPACITY } from '../ledger/field';
import type { Hasher } from './hash';

/**
 * All levels of the tree: index 0 is the leaves, the last index is `[root]`.
 * With `CAPACITY` = 64 there are seven levels (64, 32, 16, 8, 4, 2, 1 nodes).
 *
 * Throws a plain `Error` unless exactly `CAPACITY` leaves are given. That is a programming
 * error, not a posting validation, and the message never contains a value.
 */
export async function merkleLevels(hasher: Hasher, leaves: readonly bigint[]): Promise<bigint[][]> {
  if (leaves.length !== CAPACITY) {
    throw new Error('MERKLE LEAF COUNT MUST BE 64');
  }
  const levels: bigint[][] = [[...leaves]];
  let current = levels[0] ?? [];
  while (current.length > 1) {
    const next: bigint[] = [];
    for (let j = 0; j < current.length / 2; j += 1) {
      const left = current[2 * j];
      const right = current[2 * j + 1];
      if (left === undefined || right === undefined) {
        throw new Error('MERKLE LEVEL HAS ODD LENGTH');
      }
      next.push(await hasher.hashNode(left, right));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

/** The root of the tree over exactly `CAPACITY` leaves. Same error as `merkleLevels`. */
export async function merkleRoot(hasher: Hasher, leaves: readonly bigint[]): Promise<bigint> {
  const levels = await merkleLevels(hasher, leaves);
  const top = levels[levels.length - 1];
  const root = top?.[0];
  if (root === undefined) {
    throw new Error('MERKLE TREE HAS NO ROOT');
  }
  return root;
}

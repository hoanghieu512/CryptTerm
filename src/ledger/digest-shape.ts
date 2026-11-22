// Shape check for a SignedDigest (zk-core design section F).
//
// `isSignedDigestShape` applies the rules that `verifyDigest` applies before it touches the
// signature or a key. It imports the rule names from `digest.ts` and defines no pattern, key list
// or range of its own, so a change to those rules changes this check with it. It does not check
// the signature, the source key or the digest root against a batch. It never throws.
import {
  ROOT_HEX_PATTERN,
  SIGNATURE_HEX_PATTERN,
  digestMessage,
  hasExactDigestKeys,
} from './digest';
import type { SignedDigest } from './digest';

function textMatches(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

export function isSignedDigestShape(value: unknown): value is SignedDigest {
  try {
    if (!hasExactDigestKeys(value)) return false;
    const { batchId, merkleRoot, recordCount, signature, sourceKeyId } = value;
    if (typeof batchId !== 'string' || typeof sourceKeyId !== 'string') return false;
    if (!textMatches(merkleRoot, ROOT_HEX_PATTERN)) return false;
    if (!textMatches(signature, SIGNATURE_HEX_PATTERN)) return false;
    if (typeof recordCount !== 'number') return false;
    // Throws for a bad batch id, a root at or above the field modulus, or a count outside 1 to 64.
    digestMessage(batchId, BigInt(merkleRoot), recordCount);
    return true;
  } catch {
    return false;
  }
}

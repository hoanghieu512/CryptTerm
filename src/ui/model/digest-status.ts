// Signature status of the Original_Digest (terminal-ui design, section G). The host calls it once
// at load and stores the result as `signatureValid`. It never creates or changes a digest.
import { verifyDigest } from '../../ledger/digest';
import { isSignedDigestShape } from '../../ledger/digest-shape';
import { TRUSTED_SOURCE_KEYS } from '../../ledger/trusted-keys';

/**
 * True only for a digest of the exact shape whose `sourceKeyId` is an own property of `keys` and
 * whose Ed25519 signature verifies. `__proto__` and `constructor` are not own properties of the
 * frozen key table. Any throw gives false.
 */
export async function checkSignature(
  digest: unknown,
  keys: Readonly<Record<string, string>> = TRUSTED_SOURCE_KEYS,
): Promise<boolean> {
  try {
    if (!isSignedDigestShape(digest)) return false;
    if (!Object.hasOwn(keys, digest.sourceKeyId)) return false;
    return (await verifyDigest(digest, keys[digest.sourceKeyId])) === true;
  } catch {
    return false;
  }
}

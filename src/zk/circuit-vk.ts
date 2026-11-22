// The check that the verification key bytes the app loaded are the key it ships.
//
// The key file is built by `scripts/gen-circuit-identity.ts`. This module only compares: the length
// must equal VK_BYTE_LENGTH and the SHA-256 must equal VK_HASH, both from the generated
// `circuit-identity.ts`. It imports nothing else, so the worker and Node tests can use it.
import { VK_BYTE_LENGTH, VK_HASH } from './circuit-identity';
import { sha256Hex } from './sha256';

const INVALID = 'SHIPPED VERIFICATION KEY INVALID';

/** Resolves when `bytes` is the shipped key. Rejects with a fixed message for anything else. */
export async function assertShippedVk(bytes: Uint8Array): Promise<void> {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length !== VK_BYTE_LENGTH) throw new Error(INVALID);
    if ((await sha256Hex(bytes)) !== VK_HASH) throw new Error(INVALID);
  } catch {
    throw new Error(INVALID);
  }
}

// Verify link and bundle file name (terminal-ui design, section F). Pure. Both hold public
// bundle values only: the link is the bundle's URL form, the file name is its batch id.
import { encodeBundleForUrl } from '../../zk/bundle';
import type { ProofBundle } from '../../zk/bundle';

/** The path and fragment key that precede the encoded bundle. CTM900 reads the same form. */
export const VERIFY_LINK_PREFIX = '/verify#b=';

/** `/verify#b=<base64url bundle>`. Throws for a bundle that `bundleToJson` refuses. */
export function verifyLinkFor(bundle: ProofBundle): string {
  return `${VERIFY_LINK_PREFIX}${encodeBundleForUrl(bundle)}`;
}

/** `<batchId>.proof.json`. Safe as a file name because a valid bundle's batch id matches `BATCH_ID_PATTERN`. */
export function bundleFileName(bundle: ProofBundle): string {
  return `${bundle.batchId}.proof.json`;
}

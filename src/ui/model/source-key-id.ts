// The key id for the SIGNATURE row of CTM900 (verifier design, "Source key id").
//
// The report does not carry the key id, so after a passing SIGNATURE step the host decodes the
// bundle text a second time and keeps only the id. This is a second read of the string, not a
// second copy. The id is returned only when it is an own key of the trusted table, so the shown
// text is always a key of that table and never text taken from a rejected bundle. `null` shows
// nothing: no row, no status text and no message.
import { decodeBundle } from '../../zk/bundle';

export function sourceKeyIdOf(text: string, keys: Readonly<Record<string, string>>): string | null {
  try {
    const id: unknown = decodeBundle(text).sourceKeyId;
    return typeof id === 'string' && Object.hasOwn(keys, id) ? id : null;
  } catch {
    return null;
  }
}

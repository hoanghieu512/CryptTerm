// The start state of the app (verifier design, "Start state"). The route and the URL fragment are
// read once per page load, outside React, so StrictMode cannot repeat the read. The fragment is
// never read again and never written back.
import { LIMIT_CENTS } from '../../ledger/invariants';
import { VERIFY_LINK_PREFIX } from './links';
import { MESSAGES } from './messages';
import type { TerminalState } from './types';
import { initialState, settle } from './update';
import { EMPTY_VERIFY } from './verify-flow';

export interface LocationLike {
  readonly pathname: string;
  readonly hash: string;
}

// Both cut from the link prefix, so the reader and the writer of the link share one constant.
const HASH_START = VERIFY_LINK_PREFIX.indexOf('#');
const VERIFY_PATH = VERIFY_LINK_PREFIX.slice(0, HASH_START);
const HASH_PREFIX = VERIFY_LINK_PREFIX.slice(HASH_START);

/** CTM900 when the pathname is exactly `/verify`, the logon screen for every other pathname. */
export function startStateFrom(loc: LocationLike): TerminalState {
  if (loc.pathname !== VERIFY_PATH) return initialState();
  const hash = loc.hash;
  const isLink = hash.startsWith(HASH_PREFIX) && hash.length > HASH_PREFIX.length;
  const base = initialState();
  return settle({
    ...base,
    screen: 'CTM900',
    fields: { limit: LIMIT_CENTS.toString() },
    verify: isLink
      ? { ...EMPTY_VERIFY, source: 'LINK', bundleText: hash.slice(HASH_PREFIX.length), bundleSeq: 1 }
      : EMPTY_VERIFY,
    status: isLink ? MESSAGES.BUNDLE_READY : '',
  });
}

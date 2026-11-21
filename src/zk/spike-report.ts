// Pure helpers for the invalid-witness report (Requirement 9, design "Invalid-witness run").
//
// - `describeError` turns whatever `noir.execute` threw into an `ErrorShape` (shape facts only).
// - `collectTexts` and `findLeakedFields` check whether any posting value (amount, salt, account,
//   record id) shows up in the thrown value's text, as a whole token, in decimal or `0x` hex.
// - `modifyFirstSlotByOneCent` builds the invalid witness: a copy of the Spike_Witness whose slot 0
//   amount is one cent higher. The original is never mutated.
//
// Nothing here writes to `console.*`: the report is shown as page text only (Requirement 9.7).
// No DOM or worker globals, no network. Every function is pure and none echoes a posting value.
import { AMOUNT_BOUND_CENTS } from './field';
import { FLAG_YES } from './posting';
import type { Posting } from './posting';
import type { ErrorShape, LeakField } from './spike-protocol';
import type { SpikeWitness } from './spike-witness';

// ---------------------------------------------------------------------------
// describeError
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Runs `read`; returns `fallback` when it throws (hostile getters, revoked proxies). */
function guarded<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/**
 * The shape of a thrown value. Never throws: a property that cannot be read gives null.
 * `typeofThrown` is the `typeof` result. For an object, `ctorName` is its constructor name and
 * `ownPropertyNames` is `Object.getOwnPropertyNames` (non-enumerable ones included). A thrown
 * primitive has null for both, and so does an object without a named constructor.
 */
export function describeError(thrown: unknown): ErrorShape {
  const typeofThrown = typeof thrown;
  if (!isObject(thrown)) {
    return { typeofThrown, ctorName: null, ownPropertyNames: null, message: null };
  }
  const ctorName = guarded<string | null>(() => {
    const ctor: unknown = Reflect.get(thrown, 'constructor');
    return typeof ctor === 'function' && typeof ctor.name === 'string' ? ctor.name : null;
  }, null);
  const ownPropertyNames = guarded<readonly string[] | null>(
    () => Object.getOwnPropertyNames(thrown),
    null,
  );
  const message = guarded<string | null>(() => {
    const value: unknown = Reflect.get(thrown, 'message');
    return typeof value === 'string' ? value : null;
  }, null);
  return { typeofThrown, ctorName, ownPropertyNames, message };
}

// ---------------------------------------------------------------------------
// containsWholeToken
// ---------------------------------------------------------------------------

const ALPHANUMERIC = /^[a-z0-9]$/;

/** True for a letter or digit (ASCII, as the design defines it). The empty string is a delimiter. */
function isLetterOrDigit(ch: string): boolean {
  return ALPHANUMERIC.test(ch);
}

/**
 * True when `token` occurs in `text` as a whole token: case-insensitive, and the character before
 * and the character after the occurrence are not letters or digits (an underscore, a colon, a
 * space, the start and the end of the text are delimiters). Every occurrence is tried, so a later
 * one can match when an earlier one does not. An empty token never matches. Uses `indexOf`, so
 * the token is never interpreted as a pattern.
 */
export function containsWholeToken(text: string, token: string): boolean {
  if (token.length === 0) return false;
  const haystack = text.toLowerCase();
  const needle = token.toLowerCase();
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) {
    const before = i === 0 ? '' : haystack.charAt(i - 1);
    const after = haystack.charAt(i + needle.length); // '' past the end
    if (!isLetterOrDigit(before) && !isLetterOrDigit(after)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// collectTexts
// ---------------------------------------------------------------------------

/** `JSON.stringify` with bigint as decimal string. Null on a cycle, a throwing getter or undefined. */
function safeJson(value: unknown): string | null {
  return guarded<string | null>(() => {
    const json: string | undefined = JSON.stringify(value, (_key, v: unknown) =>
      typeof v === 'bigint' ? v.toString(10) : v,
    );
    return json ?? null;
  }, null);
}

function addPropertyTexts(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const element of value as readonly unknown[]) {
      if (typeof element === 'string') {
        out.push(element);
      } else if (isObject(element)) {
        const json = safeJson(element);
        if (json !== null) out.push(json);
      }
    }
  } else if (isObject(value)) {
    const json = safeJson(value);
    if (json !== null) out.push(json);
  }
}

/**
 * The texts the leak check searches: the `message` (own or inherited), every own string value
 * (`stack` included), each string inside an own array, and `JSON.stringify` of every other own
 * object value (also objects inside own arrays). A thrown string is itself one text. Never
 * throws: a property that cannot be read, or an object that cannot be serialised (cycle), is
 * skipped.
 */
export function collectTexts(error: unknown): readonly string[] {
  if (typeof error === 'string') return [error];
  if (!isObject(error)) return [];
  const out: string[] = [];
  const message = guarded<unknown>(() => Reflect.get(error, 'message'), undefined);
  if (typeof message === 'string') out.push(message);
  const names = guarded<readonly string[]>(() => Object.getOwnPropertyNames(error), []);
  for (const name of names) {
    const value = guarded<unknown>(() => Reflect.get(error, name), undefined);
    addPropertyTexts(value, out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// findLeakedFields
// ---------------------------------------------------------------------------

/** Spellings of one value: decimal, `0x` hex, and `0x` hex zero-padded to 64 digits (a field element). */
function spellings(value: bigint): readonly string[] {
  const hex = value.toString(16);
  return [value.toString(10), `0x${hex}`, `0x${hex.padStart(64, '0')}`];
}

interface FieldReader {
  readonly name: LeakField;
  readonly read: (p: Posting) => bigint;
}

/** Order of the result: the order of the page's `YES: AMOUNT, SALT` line. */
const FIELD_READERS: readonly FieldReader[] = [
  { name: 'AMOUNT', read: (p) => p.amountCents },
  { name: 'SALT', read: (p) => p.salt },
  { name: 'ACCOUNT', read: (p) => p.account },
  { name: 'RECORD ID', read: (p) => p.recordId },
];

/**
 * The names of the posting fields whose value occurs in any of `texts` as a whole token, in
 * decimal, `0x` hex or 64-digit `0x` hex form. Each name appears once, in the fixed order
 * AMOUNT, SALT, ACCOUNT, RECORD ID.
 *
 * DELIBERATE CHOICE: a value of zero is skipped. Zero is not private (padding slots and the
 * review flag use it) and the token `0` would match any lone `0` in a message, so a match would say
 * nothing about a leak. No other value is skipped.
 */
export function findLeakedFields(
  texts: readonly string[],
  postings: readonly Posting[],
): readonly LeakField[] {
  const leaked: LeakField[] = [];
  for (const { name, read } of FIELD_READERS) {
    const found = postings.some((posting) => {
      const value = read(posting);
      if (value === 0n) return false;
      return spellings(value).some((token) => texts.some((text) => containsWholeToken(text, token)));
    });
    if (found) leaked.push(name);
  }
  return leaked;
}

// ---------------------------------------------------------------------------
// modifyFirstSlotByOneCent
// ---------------------------------------------------------------------------

/**
 * A copy of `spike` whose slot 0 amount is one cent higher. The original and its postings are not
 * touched. Slot 0 is a debit in the Spike_Witness, so the copy has debits exceeding credits by
 * exactly one cent (the unbalanced case). Throws a fixed `Error` when the new amount would be
 * `2^40` or more, or above the limit while slot 0 has no review flag, so that only the balance
 * constraint can reject the copy. The caller recomputes leaves and root from the copy.
 */
export function modifyFirstSlotByOneCent(spike: SpikeWitness): SpikeWitness {
  const first = spike.postings[0];
  if (first === undefined) throw new Error('SPIKE SLOT 0 PLUS ONE CENT OUT OF RANGE');
  const amountCents = first.amountCents + 1n;
  const overLimitUnflagged = amountCents > spike.limitCents && first.reviewFlag !== FLAG_YES;
  if (amountCents >= AMOUNT_BOUND_CENTS || overLimitUnflagged) {
    throw new Error('SPIKE SLOT 0 PLUS ONE CENT OUT OF RANGE');
  }
  const modifiedFirst: Posting = Object.freeze({ ...first, amountCents });
  const postings: readonly Posting[] = Object.freeze([modifiedFirst, ...spike.postings.slice(1)]);
  return Object.freeze({
    postings,
    limitCents: spike.limitCents,
    recordCount: spike.recordCount,
  });
}

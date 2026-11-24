// Proof bundle: the public JSON document that a proof produces, and its strict codec
// (zk-core design section A). The bundle holds only public values. It is written in one canonical
// text, and `decodeBundle` accepts nothing else, so a bundle has one spelling and no key can be
// added, dropped or repeated without the decoder naming the defect.
//
// Every error is a `BundleFormatError` with a fixed code and a fixed message. No part of the
// input is ever copied into an error. This file has no `console` call and no network call.
import { BATCH_ID_PATTERN } from '../ledger/batch';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS } from '../ledger/field';
import type { Cents } from '../ledger/posting';
import { base64ToBytesStrict, base64UrlToBytesStrict, bytesToBase64, bytesToBase64Url } from './base64';

// The signature is 128 lowercase hex characters, `vkHash` is 64, and `proof` is the proof
// elements (32 bytes each) joined together, with no public inputs in it. `publicInputs` holds
// [merkle_root, record_count, limit_cents] as decimal text: it is compared, never trusted.
export interface ProofBundle {
  readonly batchId: string;
  readonly recordCount: number;
  readonly merkleRoot: bigint;
  readonly limitCents: Cents;
  readonly signature: string;
  readonly sourceKeyId: string;
  readonly proof: Uint8Array;
  readonly circuitVersion: string;
  readonly vkHash: string;
  readonly publicInputs: readonly [string, string, string];
}

// One list of codes. The order is the order of the decoder steps that can raise them.
export const BUNDLE_FORMAT_CODES = [
  'NOT_TEXT',
  'TOO_LARGE',
  'SYNTAX',
  'UNKNOWN_KEY',
  'MISSING_KEY',
  'WRONG_TYPE',
  'BAD_VALUE',
  'BAD_PROOF',
  'BAD_PUBLIC_INPUTS',
  'NOT_CANONICAL',
] as const;
export type BundleFormatCode = (typeof BUNDLE_FORMAT_CODES)[number];

/** A defect in a bundle or its text. The message is fixed per code and holds no input. */
export class BundleFormatError extends Error {
  readonly code: BundleFormatCode;
  constructor(code: BundleFormatCode) {
    super(`BUNDLE FORMAT ERROR ${code}`);
    this.name = 'BundleFormatError';
    this.code = code;
  }
}

export interface BundleKeyRow {
  readonly json: string;
  readonly field: keyof ProofBundle;
}

// The one key table. The encoder, the decoder and the tests read it. The order is the order of
// the canonical text.
export const BUNDLE_KEYS: readonly BundleKeyRow[] = [
  { json: 'batch_id', field: 'batchId' },
  { json: 'record_count', field: 'recordCount' },
  { json: 'merkle_root', field: 'merkleRoot' },
  { json: 'limit_cents', field: 'limitCents' },
  { json: 'signature', field: 'signature' },
  { json: 'source_key_id', field: 'sourceKeyId' },
  { json: 'proof', field: 'proof' },
  { json: 'circuit_version', field: 'circuitVersion' },
  { json: 'verification_key_hash', field: 'vkHash' },
  { json: 'public_inputs', field: 'publicInputs' },
];

const SIGNATURE_PATTERN = /^[0-9a-f]{128}$/;
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const VERSION_PATTERN = /^[A-Za-z0-9._+-]{1,64}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
// Canonical decimals: no sign, no leading zero. 77 digits is the width of the field modulus.
const FIELD_DECIMAL = /^(0|[1-9][0-9]{0,76})$/;
const LIMIT_DECIMAL = /^(0|[1-9][0-9]{0,12})$/;

function fail(code: BundleFormatCode): never {
  throw new BundleFormatError(code);
}

/** A string that matches `pattern`. WRONG_TYPE for another type, BAD_VALUE for a mismatch. */
function textField(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string') return fail('WRONG_TYPE');
  return pattern.test(value) ? value : fail('BAD_VALUE');
}

/** A canonical decimal string below `bound`, as a bigint. The pattern runs before `BigInt`. */
function decimalField(value: unknown, pattern: RegExp, bound: bigint): bigint {
  const parsed = BigInt(textField(value, pattern));
  return parsed < bound ? parsed : fail('BAD_VALUE');
}

function countField(value: unknown): number {
  if (typeof value !== 'number') return fail('WRONG_TYPE');
  const inRange = Number.isSafeInteger(value) && value >= 1 && value <= CAPACITY;
  return inRange ? value : fail('BAD_VALUE');
}

// Canonical base64 of a non-empty whole number of 32-byte elements.
function proofField(value: unknown): Uint8Array {
  if (typeof value !== 'string') return fail('WRONG_TYPE');
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytesStrict(value);
  } catch {
    return fail('BAD_PROOF');
  }
  return bytes.length > 0 && bytes.length % 32 === 0 ? bytes : fail('BAD_PROOF');
}

function isFieldDecimal(value: unknown): value is string {
  return typeof value === 'string' && FIELD_DECIMAL.test(value) && BigInt(value) < FIELD_MODULUS;
}

// Exactly three canonical decimals, each below the field modulus.
function inputsField(value: unknown): readonly [string, string, string] {
  if (!Array.isArray(value)) return fail('WRONG_TYPE');
  const items: unknown[] = value;
  const [a, b, c] = items;
  if (items.length !== 3 || !isFieldDecimal(a) || !isFieldDecimal(b) || !isFieldDecimal(c)) {
    return fail('BAD_PUBLIC_INPUTS');
  }
  return [a, b, c];
}

// Reads the ten values of a plain object, in key-table order, and returns a fresh bundle.
// The first defect wins, and WRONG_TYPE comes before the row's own code.
function parseFields(raw: Readonly<Record<string, unknown>>): ProofBundle {
  const batchId = textField(raw['batch_id'], BATCH_ID_PATTERN);
  const recordCount = countField(raw['record_count']);
  const merkleRoot = decimalField(raw['merkle_root'], FIELD_DECIMAL, FIELD_MODULUS);
  const limitCents = decimalField(raw['limit_cents'], LIMIT_DECIMAL, AMOUNT_BOUND_CENTS);
  const signature = textField(raw['signature'], SIGNATURE_PATTERN);
  const sourceKeyId = textField(raw['source_key_id'], KEY_ID_PATTERN);
  const proof = proofField(raw['proof']);
  const circuitVersion = textField(raw['circuit_version'], VERSION_PATTERN);
  const vkHash = textField(raw['verification_key_hash'], HASH_PATTERN);
  const publicInputs = inputsField(raw['public_inputs']);
  const first = { batchId, recordCount, merkleRoot, limitCents, signature };
  return { ...first, sourceKeyId, proof, circuitVersion, vkHash, publicInputs };
}

// The canonical text of a bundle whose fields all passed parseFields: no whitespace, key-table order.
function textOf(b: ProofBundle): string {
  const values: readonly unknown[] = [
    b.batchId, b.recordCount, b.merkleRoot.toString(10), b.limitCents.toString(10), b.signature,
    b.sourceKeyId, bytesToBase64(b.proof), b.circuitVersion, b.vkHash, [...b.publicInputs],
  ];
  return JSON.stringify(Object.fromEntries(BUNDLE_KEYS.map((row, i) => [row.json, values[i]])));
}

// A bigint becomes decimal text, bytes become base64, an array is copied. Other values pass on
// unchanged, so parseFields reports a wrong type instead of this function throwing.
function jsonValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (value instanceof Uint8Array) return bytesToBase64(value);
  return Array.isArray(value) ? [...value] : value;
}

/** The canonical JSON text of a bundle. Throws a BundleFormatError for a bundle with a bad field. */
export function bundleToJson(bundle: ProofBundle): string {
  if (typeof bundle !== 'object' || bundle === null) return fail('WRONG_TYPE');
  const raw: Record<string, unknown> = {};
  for (const row of BUNDLE_KEYS) {
    raw[row.json] = jsonValue(bundle[row.field]);
  }
  return textOf(parseFields(raw));
}

/** The URL form: base64url without padding of the UTF-8 canonical text, safe in a URL fragment. */
export function encodeBundleForUrl(bundle: ProofBundle): string {
  return bytesToBase64Url(new TextEncoder().encode(bundleToJson(bundle)));
}

/** The root as `0x` and 64 lowercase hex characters, the form that a SignedDigest holds. */
export function rootToDigestHex(root: bigint): string {
  if (typeof root !== 'bigint' || root < 0n || root >= FIELD_MODULUS) return fail('BAD_VALUE');
  return `0x${root.toString(16).padStart(64, '0')}`;
}

export const MAX_INPUT_CHARS = 1_048_576;
const URL_FORM = /^[A-Za-z0-9_-]+$/;
const EDGE_WHITESPACE = /^[ \t\r\n]+|[ \t\r\n]+$/g;
const ANY_WHITESPACE = /[ \t\r\n]/g;

// URL form to text. The bytes must be canonical base64url and valid UTF-8 that starts with `{`.
// `ignoreBOM: true` keeps a byte order mark in the text, so a BOM fails the `{` test.
function textFromUrlForm(form: string): string {
  let text: string;
  try {
    const bytes = base64UrlToBytesStrict(form);
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return fail('SYNTAX');
  }
  return text.startsWith('{') ? text : fail('SYNTAX');
}

// JSON text to an object. A parse error, including a nesting that is too deep, is SYNTAX.
function parseObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return fail('SYNTAX');
  }
}

// A key outside the ten (`__proto__` included, as JSON.parse makes it an own property) is
// UNKNOWN_KEY. A key of the ten that is not an own property is MISSING_KEY.
function checkKeys(parsed: Record<string, unknown>): void {
  const allowed = new Set(BUNDLE_KEYS.map((row) => row.json));
  if (Object.keys(parsed).some((key) => !allowed.has(key))) fail('UNKNOWN_KEY');
  if (BUNDLE_KEYS.some((row) => !Object.hasOwn(parsed, row.json))) fail('MISSING_KEY');
}


// Picks the form by the first character. `{` is JSON text. Otherwise the text must be URL form.
function sourceText(input: string): { readonly text: string; readonly json: boolean } {
  const trimmed = input.replace(EDGE_WHITESPACE, '');
  if (trimmed.startsWith('{')) return { text: trimmed, json: true };
  if (URL_FORM.test(trimmed)) return { text: textFromUrlForm(trimmed), json: false };
  return fail('SYNTAX');
}

/**
 * Decodes the canonical JSON text or the URL form into a bundle, or throws a BundleFormatError.
 * The first defect wins. The last step rebuilds the canonical text from the validated fields and
 * compares it with the input, so duplicate keys, other key orders, escapes and other spellings of
 * a number are all NOT_CANONICAL. The JSON form may carry whitespace between tokens.
 */
export function decodeBundle(input: string): ProofBundle {
  if (typeof input !== 'string') return fail('NOT_TEXT');
  if (input.length > MAX_INPUT_CHARS) return fail('TOO_LARGE');
  const { text, json } = sourceText(input);
  const parsed = parseObject(text);
  checkKeys(parsed);
  const candidate = parseFields(parsed);
  const expected = json ? text.replace(ANY_WHITESPACE, '') : text;
  return textOf(candidate) === expected ? candidate : fail('NOT_CANONICAL');
}

// Generators for the proof bundle codec tests (zk-core Requirements 5 and 6).
// The plain JSON object and its text are built here from the bundle fields, with Node's Buffer
// for base64. They do not call the codec under test, so the codec is checked against this copy.
// Synthetic data only, and nothing here prints anything.
import fc from 'fast-check';
import { AMOUNT_BOUND_CENTS, FIELD_MODULUS } from '../../src/ledger/field';
import type { ProofBundle } from '../../src/zk/bundle';
import { batchIdArb } from './ledger-arbitraries';
import { hexStringArb, validCountArb, validRootArb } from './digest-arbitraries';

/** Exact JSON key order of the bundle (design section A, key table). */
export const PLAIN_KEY_ORDER: readonly string[] = [
  'batch_id', 'record_count', 'merkle_root', 'limit_cents', 'signature',
  'source_key_id', 'proof', 'circuit_version', 'verification_key_hash', 'public_inputs',
];

/** A distinctive string planted into rejected input. No error text may repeat it. */
export const BUNDLE_SENTINEL = 'S3NT1N3L918273645';

export type PlainBundle = Record<string, unknown>;

/** The bundle as a plain object in canonical key order, with values as the JSON text holds them. */
export function toPlain(b: ProofBundle): PlainBundle {
  const values: Record<string, unknown> = {};
  values['batch_id'] = b.batchId;
  values['record_count'] = b.recordCount;
  values['merkle_root'] = b.merkleRoot.toString(10);
  values['limit_cents'] = b.limitCents.toString(10);
  values['signature'] = b.signature;
  values['source_key_id'] = b.sourceKeyId;
  values['proof'] = Buffer.from(b.proof).toString('base64');
  values['circuit_version'] = b.circuitVersion;
  values['verification_key_hash'] = b.vkHash;
  values['public_inputs'] = [...b.publicInputs];
  return values;
}

/** The canonical JSON text, written independently of `bundleToJson`. */
export function canonicalText(b: ProofBundle): string {
  return JSON.stringify(toPlain(b));
}

const ID_CHARS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-'];
const VERSION_CHARS = [...ID_CHARS, '+'];

function textArb(chars: readonly string[], maxLength: number): fc.Arbitrary<string> {
  return fc.array(fc.constantFrom(...chars), { minLength: 1, maxLength }).map((c) => c.join(''));
}

// Source key ids: the demo shape, anything the key table allows, and three hostile names.
const sourceKeyIdArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: hexStringArb(16).map((h) => `DEMO-${h}`) },
  { weight: 2, arbitrary: textArb(ID_CHARS, 64) },
  { weight: 1, arbitrary: fc.constantFrom('__proto__', 'constructor', 'toString') },
);

const circuitVersionArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 1, arbitrary: hexStringArb(32).map((h) => `nargo-1.0.0+${h}`) },
  { weight: 1, arbitrary: textArb(VERSION_CHARS, 64) },
);

const limitArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(0n, 1n, 1_000_000n, 2_000_000n, AMOUNT_BOUND_CENTS - 1n) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: AMOUNT_BOUND_CENTS - 1n }) },
);

// Proof bytes: 1 to 8 elements of 32 bytes each.
const proofArb: fc.Arbitrary<Uint8Array> = fc
  .integer({ min: 1, max: 8 })
  .chain((elements) => fc.uint8Array({ minLength: elements * 32, maxLength: elements * 32 }));

const fieldDecimalArb: fc.Arbitrary<string> = validRootArb.map((v) => v.toString(10));

const publicInputsArb: fc.Arbitrary<readonly [string, string, string]> = fc
  .tuple(fieldDecimalArb, fieldDecimalArb, fieldDecimalArb)
  .map(([a, b, c]) => [a, b, c] as const);

/** Valid bundles: every field inside its rule, ten keys. */
export const proofBundleArb: fc.Arbitrary<ProofBundle> = fc
  .record({
    batchId: batchIdArb,
    recordCount: validCountArb,
    merkleRoot: validRootArb,
    limitCents: limitArb,
    signature: hexStringArb(128),
    sourceKeyId: sourceKeyIdArb,
    proof: proofArb,
    circuitVersion: circuitVersionArb,
    vkHash: hexStringArb(64),
    publicInputs: publicInputsArb,
  })
  // fast-check builds records with a null prototype. Spread gives a plain object, as the codec returns.
  .map((b): ProofBundle => ({ ...b }));

export interface BundleDefect {
  readonly name: string;
  /** Input text with one planted defect. */
  readonly text: string;
  /** The `BundleFormatError` code the defect must give. */
  readonly code: string;
}

type DefectMaker = (b: ProofBundle, pick: number) => { text: string; code: string };

/** The plain object with one key replaced, key order kept. */
function withValue(b: ProofBundle, key: string, value: unknown): string {
  return JSON.stringify({ ...toPlain(b), [key]: value });
}

function oneOf<T>(items: readonly T[], pick: number): T {
  return items[pick % items.length] as T;
}

const THIRTY_ONE_BYTES = Buffer.alloc(31).toString('base64');
// 32 zero bytes end in `A=`. Changing that `A` to `B` sets padding bits, which is not canonical.
const NON_CANONICAL_PROOF = `${Buffer.alloc(32).toString('base64').slice(0, 42)}B=`;

const truncated: DefectMaker = (b, pick) => {
  const text = canonicalText(b);
  return { text: text.slice(0, 1 + (pick % (text.length - 1))), code: 'SYNTAX' };
};

const missingKey: DefectMaker = (b, pick) => {
  const plain = toPlain(b);
  delete plain[oneOf(PLAIN_KEY_ORDER, pick)];
  return { text: JSON.stringify(plain), code: 'MISSING_KEY' };
};

const UNKNOWN_NAMES = [BUNDLE_SENTINEL, '__proto__', 'constructor', 'proof2'] as const;

const unknownKey: DefectMaker = (b, pick) => {
  const text = canonicalText(b);
  const extra = `,"${oneOf(UNKNOWN_NAMES, pick)}":1}`;
  return { text: text.slice(0, -1) + extra, code: 'UNKNOWN_KEY' };
};

const WRONG_TYPES: readonly (readonly [string, unknown])[] = [
  ['record_count', BUNDLE_SENTINEL],
  ['limit_cents', 5],
  ['public_inputs', BUNDLE_SENTINEL],
  ['proof', 7],
  ['batch_id', 5],
  ['signature', null],
  ['merkle_root', { nested: BUNDLE_SENTINEL }],
];

const wrongType: DefectMaker = (b, pick) => {
  const [key, value] = oneOf(WRONG_TYPES, pick);
  return { text: withValue(b, key, value), code: 'WRONG_TYPE' };
};

// Values outside their field rule, by key.
const BAD_BY_KEY: Readonly<Record<string, readonly unknown[]>> = {
  merkle_root: [FIELD_MODULUS.toString(10), '01', BUNDLE_SENTINEL],
  record_count: [0, 65, -1, 1.5],
  limit_cents: [AMOUNT_BOUND_CENTS.toString(10), '-1'],
  signature: ['A'.repeat(128)],
  batch_id: [BUNDLE_SENTINEL],
  source_key_id: [`a b ${BUNDLE_SENTINEL}`],
  circuit_version: [''],
  verification_key_hash: ['F'.repeat(64)],
};

const BAD_VALUES: readonly (readonly [string, unknown])[] = Object.entries(BAD_BY_KEY).flatMap(
  ([key, values]) => values.map((value): readonly [string, unknown] => [key, value]),
);

const badValue: DefectMaker = (b, pick) => {
  const [key, value] = oneOf(BAD_VALUES, pick);
  return { text: withValue(b, key, value), code: 'BAD_VALUE' };
};

// `public_inputs` arrays that are not exactly three canonical decimals below the field modulus.
const BAD_INPUTS: readonly (readonly string[])[] = [
  [],
  ['1', '2'],
  ['1', '2', '3', '4'],
  ['1', '2', '03'],
  ['1', '2', FIELD_MODULUS.toString(10)],
  ['1', '2', BUNDLE_SENTINEL],
];

const badPublicInputs: DefectMaker = (b, pick) => ({
  text: withValue(b, 'public_inputs', oneOf(BAD_INPUTS, pick)),
  code: 'BAD_PUBLIC_INPUTS',
});

// `proof` values that are empty, misaligned, not base64, or base64 that is not canonical.
const BAD_PROOFS: readonly string[] = [
  '',
  THIRTY_ONE_BYTES,
  '!!!!',
  BUNDLE_SENTINEL,
  Buffer.alloc(32).toString('base64').slice(0, 43),
  NON_CANONICAL_PROOF,
];

const badProof: DefectMaker = (b, pick) => ({
  text: withValue(b, 'proof', oneOf(BAD_PROOFS, pick)),
  code: 'BAD_PROOF',
});

// Another spelling of the record count: `5.0` or `5e0` for 5.
function respellCount(b: ProofBundle, text: string, suffix: string): string {
  const original = `"record_count":${b.recordCount},`;
  return text.replace(original, `"record_count":${b.recordCount}${suffix},`);
}

// Valid fields in a text that is not the canonical one. Each rewrite keeps every value the same.
const NOT_CANONICAL_REWRITES: readonly ((b: ProofBundle, text: string) => string)[] = [
  (b) => JSON.stringify(Object.fromEntries(Object.entries(toPlain(b)).reverse())),
  (b, text) => `${text.slice(0, -1)},"batch_id":"${b.batchId}"}`,
  (_b, text) => text.replace('"batch_id"', '"\\u0062atch_id"'),
  (b, text) => respellCount(b, text, '.0'),
  (b, text) => respellCount(b, text, 'e0'),
];

const notCanonical: DefectMaker = (b, pick) => {
  const text = oneOf(NOT_CANONICAL_REWRITES, pick)(b, canonicalText(b));
  return { text, code: 'NOT_CANONICAL' };
};

const DEFECT_MAKERS = new Map<string, DefectMaker>([
  ['truncated', truncated],
  ['missingKey', missingKey],
  ['unknownKey', unknownKey],
  ['wrongType', wrongType],
  ['badValue', badValue],
  ['badPublicInputs', badPublicInputs],
  ['badProof', badProof],
  ['notCanonical', notCanonical],
]);

/** A valid bundle with one planted defect, as JSON text, with the code the decoder must give. */
export const bundleDefectArb: fc.Arbitrary<BundleDefect> = fc
  .tuple(proofBundleArb, fc.constantFrom(...DEFECT_MAKERS.keys()), fc.nat())
  .map(([bundle, name, pick]) => {
    const make = DEFECT_MAKERS.get(name);
    if (make === undefined) throw new Error('FIXTURE DEFECT MISSING');
    return { name, ...make(bundle, pick) };
  });

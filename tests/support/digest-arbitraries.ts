// fast-check generators and Ed25519 helpers for the digest property tests
// (ledger-format Properties digest_message_unambiguous, digest_tamper_detected,
// verify_digest_never_throws).
//
// Everything here is synthetic. The signing helpers below make EPHEMERAL Ed25519 keys with
// `crypto.subtle` inside the test process. They never read the Demo_Key and never import from
// `scripts/`. Signing in tests is allowed. Signing in `src/` is not (security.md rule 2).
//
// Amounts rule: the Merkle root is a `bigint`, record counts are small integers. No `Number`
// or `parseInt` is applied to a root. Hex is encoded and decoded with string and byte
// arithmetic only.
//
// Web-platform calls used (Node 24 WebCrypto, https://nodejs.org/docs/latest-v24.x/api/webcrypto.html):
//   subtle.generateKey('Ed25519', extractable, ['sign', 'verify'])  -> CryptoKeyPair
//   subtle.exportKey('raw', publicKey)                              -> ArrayBuffer, 32 bytes
//   subtle.sign('Ed25519', privateKey, data)                        -> ArrayBuffer, 64 bytes
import fc from 'fast-check';
import { BATCH_ID_PATTERN } from '../../src/ledger/batch';
import { digestMessage } from '../../src/ledger/digest';
import type { SignedDigest } from '../../src/ledger/digest';
import { CAPACITY, FIELD_MODULUS } from '../../src/ledger/field';
import { batchIdArb } from './ledger-arbitraries';

// ---------------------------------------------------------------------------------------------
// Triples
// ---------------------------------------------------------------------------------------------

/** The three signed fields. `merkleRoot` is a `bigint`. */
export interface DigestTriple {
  readonly batchId: string;
  readonly merkleRoot: bigint;
  readonly recordCount: number;
}

/** Roots at and around the edges of the field, plus uniform draws over the whole field. */
export const validRootArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: FIELD_MODULUS - 1n }) },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      0n,
      1n,
      2n ** 40n - 1n,
      2n ** 53n,
      2n ** 248n,
      2n ** 253n,
      FIELD_MODULUS - 2n,
      FIELD_MODULUS - 1n,
    ),
  },
  { weight: 1, arbitrary: fc.bigInt({ min: 0n, max: 2n ** 20n }) },
);

/** 1 to 64, with the edges favoured. */
export const validCountArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(1, 2, CAPACITY - 1, CAPACITY) },
  { weight: 4, arbitrary: fc.integer({ min: 1, max: CAPACITY }) },
);

export const validTripleArb: fc.Arbitrary<DigestTriple> = fc
  .tuple(batchIdArb, validRootArb, validCountArb)
  .map(([batchId, merkleRoot, recordCount]) => ({ batchId, merkleRoot, recordCount }));

/** Two valid triples that differ in at least one field. */
export const differentTriplesArb: fc.Arbitrary<readonly [DigestTriple, DigestTriple]> = fc
  .tuple(validTripleArb, validTripleArb)
  .filter(([a, b]) => !sameTriple(a, b));

/** A valid triple and a second valid triple that differs from it in exactly one field. */
export const oneFieldChangedArb: fc.Arbitrary<{
  readonly field: 'batchId' | 'merkleRoot' | 'recordCount';
  readonly a: DigestTriple;
  readonly b: DigestTriple;
}> = fc
  .tuple(validTripleArb, validTripleArb, fc.constantFrom(...(['batchId', 'merkleRoot', 'recordCount'] as const)))
  .map(([a, other, field]) => ({ field, a, b: { ...a, [field]: other[field] } as DigestTriple }))
  .filter(({ field, a, b }) => a[field] !== b[field]);

export function sameTriple(a: DigestTriple, b: DigestTriple): boolean {
  return a.batchId === b.batchId && a.merkleRoot === b.merkleRoot && a.recordCount === b.recordCount;
}

// ---------------------------------------------------------------------------------------------
// Invalid inputs for digestMessage
// ---------------------------------------------------------------------------------------------

/** Strings that do not match BATCH_ID_PATTERN, plus non-strings. */
export const invalidBatchIdArb: fc.Arbitrary<unknown> = fc.oneof(
  {
    weight: 6,
    arbitrary: batchIdArb.chain((id) =>
      fc
        .constantFrom<unknown>(
          '',
          `${id}X`,
          `${id}\n`,
          ` ${id}`,
          `${id} `,
          id.slice(0, -1),
          id.toLowerCase(),
          id.replace('CTB', 'CTX'),
          id.replaceAll('-', '_'),
          id.replace(/[0-9]$/, '٣'),
          id.replace('CTB-', 'CTB-0'),
          'CTB-2026120-0011',
          'x'.repeat(16),
        )
        .filter((s) => typeof s === 'string' && !BATCH_ID_PATTERN.test(s)),
    ),
  },
  { weight: 2, arbitrary: fc.string({ maxLength: 40 }).filter((s) => !BATCH_ID_PATTERN.test(s)) },
  {
    weight: 2,
    arbitrary: fc.constantFrom<unknown>(undefined, null, 0, 20261201, NaN, true, 5n, [], {}, ['CTB-20261201-001']),
  },
);

/** Roots outside `0 <= root < FIELD_MODULUS`, and values that are not a bigint. */
export const invalidRootArb: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 3, arbitrary: fc.bigInt({ min: -(2n ** 300n), max: -1n }) },
  { weight: 3, arbitrary: fc.bigInt({ min: FIELD_MODULUS, max: FIELD_MODULUS + 2n ** 256n }) },
  {
    weight: 2,
    arbitrary: fc.constantFrom<unknown>(-1n, -FIELD_MODULUS, FIELD_MODULUS, FIELD_MODULUS + 1n, 2n ** 254n, 2n ** 256n - 1n),
  },
  {
    weight: 2,
    arbitrary: fc.constantFrom<unknown>(undefined, null, 0, 1, 12345, NaN, Infinity, '0', '12345', true, [], {}),
  },
);

/** Counts that are not an integer from 1 to 64. */
export const invalidCountArb: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<unknown>(0, 65, -0, -1, NaN, Infinity, -Infinity, 1.5, 63.999, 2 ** 32, 2 ** 53) },
  { weight: 2, arbitrary: fc.integer({ min: CAPACITY + 1, max: 2 ** 32 + 5 }) },
  { weight: 2, arbitrary: fc.integer({ min: -(2 ** 31), max: 0 }) },
  { weight: 2, arbitrary: fc.double({ noInteger: true, min: 0.01, max: 100 }) },
  { weight: 2, arbitrary: fc.constantFrom<unknown>(undefined, null, '12', 12n, true, [], {}) },
);

// ---------------------------------------------------------------------------------------------
// Hex and byte helpers (string and byte arithmetic only)
// ---------------------------------------------------------------------------------------------

const HEX_DIGITS = '0123456789abcdef';

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += HEX_DIGITS.charAt(byte >> 4) + HEX_DIGITS.charAt(byte & 15);
  }
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('FIXTURE HEX LENGTH');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const high = HEX_DIGITS.indexOf(hex.charAt(2 * i));
    const low = HEX_DIGITS.indexOf(hex.charAt(2 * i + 1));
    if (high < 0 || low < 0) throw new Error('FIXTURE HEX DIGIT');
    out[i] = high * 16 + low;
  }
  return out;
}

/** `0x` plus 64 lowercase hex characters. The root must already be in `[0, 2^256)`. */
export function rootToHex(root: bigint): string {
  return `0x${root.toString(16).padStart(64, '0')}`;
}

/** Big-endian bytes to bigint, independent of `src/ledger/field.ts`. */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return value;
}

/** Lowercase hex of `length` characters. */
export function hexStringArb(length: number): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...HEX_DIGITS), { minLength: length, maxLength: length })
    .map((chars) => chars.join(''));
}

/** `DEMO-` plus 16 lowercase hex characters. */
export const sourceKeyIdArb: fc.Arbitrary<string> = hexStringArb(16).map((hex) => `DEMO-${hex}`);

// ---------------------------------------------------------------------------------------------
// Ephemeral Ed25519 keys and signing (test code only)
// ---------------------------------------------------------------------------------------------

export interface EphemeralKey {
  readonly privateKey: CryptoKey;
  /** 32-byte raw public key, 64 lowercase hex characters. */
  readonly publicKeyHex: string;
}

/** Makes `count` fresh Ed25519 keys. The private halves stay inside the test process. */
export async function makeEphemeralKeys(count: number): Promise<EphemeralKey[]> {
  const subtle = globalThis.crypto.subtle;
  const keys: EphemeralKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
    keys.push({ privateKey: pair.privateKey, publicKeyHex: toHex(raw) });
  }
  return keys;
}

/** Signs `digestMessage(triple)` and returns the `SignedDigest`, keys in the design order. */
export async function signTriple(
  key: EphemeralKey,
  triple: DigestTriple,
  sourceKeyId: string,
): Promise<SignedDigest> {
  const message = digestMessage(triple.batchId, triple.merkleRoot, triple.recordCount);
  // Copy into a fresh buffer so the argument is a plain `BufferSource` whatever `digestMessage` returns.
  const data = new Uint8Array(message.length);
  data.set(message);
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign('Ed25519', key.privateKey, data));
  return {
    batchId: triple.batchId,
    merkleRoot: rootToHex(triple.merkleRoot),
    recordCount: triple.recordCount,
    signature: toHex(signature),
    sourceKeyId,
  };
}

/** One signature bit flipped. `bitIndex` counts from the first hex character, 0 to 511. */
export function flipSignatureBit(signatureHex: string, bitIndex: number): string {
  const bytes = fromHex(signatureHex);
  const at = bitIndex >> 3;
  const current = bytes[at];
  if (current === undefined) throw new Error('FIXTURE BIT INDEX');
  bytes[at] = current ^ (1 << (bitIndex & 7));
  return toHex(bytes);
}

// ---------------------------------------------------------------------------------------------
// Junk inputs for verifyDigest
// ---------------------------------------------------------------------------------------------

export const DIGEST_KEYS = ['batchId', 'merkleRoot', 'recordCount', 'signature', 'sourceKeyId'] as const;
export type DigestKey = (typeof DIGEST_KEYS)[number];

/** A value that throws on every read of `toString`, `valueOf` and `Symbol.toPrimitive`. */
export function hostileValue(): unknown {
  const boom = (): never => {
    throw new Error('HOSTILE VALUE');
  };
  return {
    toString: boom,
    valueOf: boom,
    [Symbol.toPrimitive]: boom,
  };
}

/** A Proxy that throws on every trap an engine can reach. */
export function throwingProxy(): unknown {
  const boom = (): never => {
    throw new Error('HOSTILE PROXY');
  };
  return new Proxy(
    {},
    {
      get: boom,
      has: boom,
      ownKeys: boom,
      getOwnPropertyDescriptor: boom,
      getPrototypeOf: boom,
      set: boom,
      defineProperty: boom,
      deleteProperty: boom,
      isExtensible: boom,
    },
  );
}

/** A plain object whose five data keys are getters. The getters named in `throwing` throw. */
export function digestWithThrowingGetters(
  base: SignedDigest,
  throwing: readonly DigestKey[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of DIGEST_KEYS) {
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: true,
      get: () => {
        if (throwing.includes(key)) throw new Error('HOSTILE GETTER');
        return base[key];
      },
    });
  }
  return out;
}

/**
 * One damage applied to a well-formed digest and public key. Every mutation produces an input
 * that `verifyDigest` must reject with `false`, whatever else is true of the input.
 */
export type DigestMutation =
  | { readonly kind: 'dropKey'; readonly key: DigestKey }
  | { readonly kind: 'setKey'; readonly key: DigestKey; readonly value: unknown }
  | { readonly kind: 'extraKey'; readonly name: string; readonly value: unknown }
  | { readonly kind: 'upperSignature' }
  | { readonly kind: 'dropSignatureChar' }
  | { readonly kind: 'addSignatureChar' }
  | { readonly kind: 'badPublicKey'; readonly value: unknown }
  | { readonly kind: 'upperPublicKey' }
  | { readonly kind: 'prefixPublicKey' }
  | { readonly kind: 'otherPublicKey' }
  | { readonly kind: 'asBytesPublicKey' }
  | { readonly kind: 'throwingGetter'; readonly keys: readonly DigestKey[] }
  | { readonly kind: 'hostileKey'; readonly key: DigestKey }
  | { readonly kind: 'hostilePublicKey' }
  | { readonly kind: 'proxyPublicKey' }
  | { readonly kind: 'proxyDigest' }
  | { readonly kind: 'wholeDigest'; readonly value: unknown };

const HOSTILE_PUBLIC_KEY_VALUES: readonly unknown[] = [
  undefined,
  null,
  0,
  1,
  NaN,
  true,
  5n,
  {},
  [],
  [1, 2, 3],
  '',
  'a'.repeat(63),
  'a'.repeat(65),
  'g'.repeat(64),
  ' '.repeat(64),
  `${'a'.repeat(62)}\n\n`,
  // Well-shaped hex that is not a usable Ed25519 public key (small-order and non-canonical points).
  '0'.repeat(64),
  '0100000000000000000000000000000000000000000000000000000000000000',
  'f'.repeat(64),
  `${'f'.repeat(62)}7f`,
  `ecff${'f'.repeat(58)}7f`,
];

const WRONG_TYPE_VALUES: readonly unknown[] = [undefined, null, 0, 12, NaN, true, 5n, [], {}, ['x']];

const SET_KEY_VALUES: Readonly<Record<DigestKey, readonly unknown[]>> = {
  batchId: [
    ...WRONG_TYPE_VALUES,
    '',
    'CTB-20261201-0011',
    'CTB-20261201-01',
    'ctb-20261201-001',
    'CTB-20261201-001\n',
    ' CTB-20261201-001',
    'CTB_20261201_001',
    'x'.repeat(16),
  ],
  merkleRoot: [
    ...WRONG_TYPE_VALUES,
    '',
    '0x',
    `0x${'0'.repeat(63)}`,
    `0x${'0'.repeat(65)}`,
    '0'.repeat(64),
    `0X${'0'.repeat(64)}`,
    `0x${'g'.repeat(64)}`,
    `0x${'A'.repeat(64)}`,
    ` 0x${'0'.repeat(64)}`,
    // Root at or above the field modulus, in the well-formed hex shape.
    rootToHex(FIELD_MODULUS),
    rootToHex(FIELD_MODULUS + 1n),
    rootToHex(2n ** 255n),
    rootToHex(2n ** 256n - 1n),
    // A bigint and a decimal string instead of hex.
    7n,
    '7',
  ],
  recordCount: [
    ...WRONG_TYPE_VALUES,
    0,
    65,
    -1,
    1.5,
    Infinity,
    -Infinity,
    2 ** 32,
    2 ** 53,
    Number.MAX_SAFE_INTEGER,
    '12',
    12n,
  ],
  signature: [
    ...WRONG_TYPE_VALUES,
    '',
    '0'.repeat(127),
    '0'.repeat(129),
    '0'.repeat(126),
    'g'.repeat(128),
    `0x${'0'.repeat(126)}`,
    ` ${'0'.repeat(127)}`,
  ],
  sourceKeyId: [...WRONG_TYPE_VALUES],
};

const EXTRA_KEY_NAMES: readonly string[] = ['extra', 'privateKey', 'proof', '__proto__', 'constructor', 'toString', ''];

export const digestMutationArb: fc.Arbitrary<DigestMutation> = fc.oneof(
  {
    weight: 2,
    arbitrary: fc.constantFrom(...DIGEST_KEYS).map((key): DigestMutation => ({ kind: 'dropKey', key })),
  },
  {
    weight: 8,
    arbitrary: fc
      .constantFrom(...DIGEST_KEYS)
      .chain((key) =>
        fc.constantFrom(...SET_KEY_VALUES[key]).map((value): DigestMutation => ({ kind: 'setKey', key, value })),
      ),
  },
  {
    weight: 2,
    arbitrary: fc
      .tuple(fc.constantFrom(...EXTRA_KEY_NAMES), fc.anything())
      .map(([name, value]): DigestMutation => ({ kind: 'extraKey', name, value })),
  },
  {
    weight: 2,
    arbitrary: fc.constantFrom<DigestMutation>(
      { kind: 'upperSignature' },
      { kind: 'dropSignatureChar' },
      { kind: 'addSignatureChar' },
      { kind: 'upperPublicKey' },
      { kind: 'prefixPublicKey' },
      { kind: 'otherPublicKey' },
      { kind: 'asBytesPublicKey' },
    ),
  },
  {
    weight: 4,
    arbitrary: fc
      .constantFrom(...HOSTILE_PUBLIC_KEY_VALUES)
      .map((value): DigestMutation => ({ kind: 'badPublicKey', value })),
  },
  {
    weight: 2,
    arbitrary: fc
      .subarray([...DIGEST_KEYS], { minLength: 1 })
      .map((keys): DigestMutation => ({ kind: 'throwingGetter', keys })),
  },
  {
    // Hostile objects are built in `applyMutation`, not here, so a failure report never has to
    // print an object that throws when read.
    weight: 2,
    arbitrary: fc.oneof(
      fc.constantFrom(...DIGEST_KEYS).map((key): DigestMutation => ({ kind: 'hostileKey', key })),
      fc.constantFrom<DigestMutation>({ kind: 'hostilePublicKey' }, { kind: 'proxyPublicKey' }, { kind: 'proxyDigest' }),
    ),
  },
  {
    weight: 3,
    arbitrary: fc
      .oneof(
        fc.anything(),
        fc.constantFrom<unknown>(
          undefined,
          null,
          0,
          NaN,
          '',
          '{}',
          'CTB-20261201-001',
          true,
          5n,
          [],
          [1, 2],
          new Date(0),
          () => 1,
          Symbol('digest'),
          Object.create(null),
        ),
      )
      .map((value): DigestMutation => ({ kind: 'wholeDigest', value })),
  },
);

/** The two arguments of `verifyDigest`, typed `unknown` because they are junk on purpose. */
export interface VerifyArgs {
  readonly digest: unknown;
  readonly publicKeyHex: unknown;
}

/**
 * Applies one mutation. `base` and `publicKeyHex` are a real signed digest and its real key
 * (so the unmutated pair verifies true). `otherPublicKeyHex` is a different valid key.
 */
export function applyMutation(
  mutation: DigestMutation,
  base: SignedDigest,
  publicKeyHex: string,
  otherPublicKeyHex: string,
): VerifyArgs {
  const copy: Record<string, unknown> = { ...base };
  switch (mutation.kind) {
    case 'dropKey': {
      delete copy[mutation.key];
      return { digest: copy, publicKeyHex };
    }
    case 'setKey': {
      copy[mutation.key] = mutation.value;
      return { digest: copy, publicKeyHex };
    }
    case 'extraKey': {
      Object.defineProperty(copy, mutation.name, {
        value: mutation.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return { digest: copy, publicKeyHex };
    }
    case 'upperSignature': {
      copy.signature = base.signature.toUpperCase();
      return { digest: copy, publicKeyHex };
    }
    case 'dropSignatureChar': {
      copy.signature = base.signature.slice(1);
      return { digest: copy, publicKeyHex };
    }
    case 'addSignatureChar': {
      copy.signature = `${base.signature}0`;
      return { digest: copy, publicKeyHex };
    }
    case 'badPublicKey': {
      return { digest: copy, publicKeyHex: mutation.value };
    }
    case 'upperPublicKey': {
      return { digest: copy, publicKeyHex: publicKeyHex.toUpperCase() };
    }
    case 'prefixPublicKey': {
      return { digest: copy, publicKeyHex: `0x${publicKeyHex}` };
    }
    case 'otherPublicKey': {
      return { digest: copy, publicKeyHex: otherPublicKeyHex };
    }
    case 'asBytesPublicKey': {
      return { digest: copy, publicKeyHex: fromHex(publicKeyHex) };
    }
    case 'throwingGetter': {
      return { digest: digestWithThrowingGetters(base, mutation.keys), publicKeyHex };
    }
    case 'hostileKey': {
      copy[mutation.key] = hostileValue();
      return { digest: copy, publicKeyHex };
    }
    case 'hostilePublicKey': {
      return { digest: copy, publicKeyHex: hostileValue() };
    }
    case 'proxyPublicKey': {
      return { digest: copy, publicKeyHex: throwingProxy() };
    }
    case 'proxyDigest': {
      return { digest: throwingProxy(), publicKeyHex };
    }
    case 'wholeDigest': {
      return { digest: mutation.value, publicKeyHex };
    }
  }
}

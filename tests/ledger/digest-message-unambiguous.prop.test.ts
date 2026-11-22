import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { digestMessage } from '../../src/ledger/digest';
import { FIELD_MODULUS } from '../../src/ledger/field';
import { runProperty } from '../support/pbt';
import {
  bytesToBigInt,
  differentTriplesArb,
  fromHex,
  invalidBatchIdArb,
  invalidCountArb,
  invalidRootArb,
  oneFieldChangedArb,
  validCountArb,
  validRootArb,
  validTripleArb,
} from '../support/digest-arbitraries';
import type { DigestTriple } from '../support/digest-arbitraries';
import { batchIdArb } from '../support/ledger-arbitraries';

// Feature: ledger-format, Property digest_message_unambiguous: For all two different valid triples, digestMessage returns messages of equal length that differ, and invalid triples throw
// **Validates: Requirements 6.1, 6.2, 6.3**
//
// Seed 20262008, 500 runs. Layout under test (design.md "Digest"):
//   offset  0, 19 bytes  ASCII `CRYPTTERM-DIGEST-V1`
//   offset 19, 16 bytes  batchId, ASCII
//   offset 35, 32 bytes  merkleRoot, big-endian
//   offset 67,  4 bytes  recordCount, uint32 big-endian
//   total 71 bytes
// The expected bytes are rebuilt here with their own encoder, not through `fieldToBytes32`.
// Invalid inputs must throw an Error whose message is exactly `DIGEST INPUT INVALID`.
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262008;
const NUM_RUNS = 500;

const TAG = 'CRYPTTERM-DIGEST-V1';
const TAG_LENGTH = 19;
const BATCH_ID_OFFSET = 19;
const BATCH_ID_LENGTH = 16;
const ROOT_OFFSET = 35;
const ROOT_LENGTH = 32;
const COUNT_OFFSET = 67;
const COUNT_LENGTH = 4;
const MESSAGE_LENGTH = 71;
const FIXED_MESSAGE = 'DIGEST INPUT INVALID';

/** `digestMessage` called with arguments of any type, for the invalid-input cases. */
const callUntyped = digestMessage as (batchId: unknown, merkleRoot: unknown, recordCount: unknown) => Uint8Array;

function messageOf(t: DigestTriple): Uint8Array {
  return digestMessage(t.batchId, t.merkleRoot, t.recordCount);
}

/** ASCII bytes of a string whose characters are all below 0x80. */
function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new Error('FIXTURE NOT ASCII');
    out[i] = code;
  }
  return out;
}

/** Big-endian bytes of a bigint in a fixed width. */
function bigEndian(value: bigint, width: number): Uint8Array {
  const hex = value.toString(16);
  if (value < 0n || hex.length > width * 2) throw new Error('FIXTURE VALUE OUT OF WIDTH');
  return fromHex(hex.padStart(width * 2, '0'));
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function expectedMessage(t: DigestTriple): Uint8Array {
  return concat([
    asciiBytes(TAG),
    asciiBytes(t.batchId),
    bigEndian(t.merkleRoot, ROOT_LENGTH),
    bigEndian(BigInt(t.recordCount), COUNT_LENGTH),
  ]);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Asserts that `fn` throws an Error whose message is exactly the fixed digest message. */
function expectFixedThrow(fn: () => unknown): void {
  let thrown: unknown;
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    thrown = error;
  }
  expect(threw).toBe(true);
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(FIXED_MESSAGE);
}

describe('digest_message_unambiguous', () => {
  it('digest_message_unambiguous: every valid triple gives the 71-byte message at the documented offsets', () => {
    runProperty(
      'ledger-format digest_message_unambiguous layout',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(validTripleArb, (triple) => {
        const message = messageOf(triple);
        expect(message).toBeInstanceOf(Uint8Array);
        expect(message.length).toBe(MESSAGE_LENGTH);
        expect(TAG.length).toBe(TAG_LENGTH);
        expect(sameBytes(message.slice(0, TAG_LENGTH), asciiBytes(TAG))).toBe(true);
        expect(sameBytes(message.slice(BATCH_ID_OFFSET, BATCH_ID_OFFSET + BATCH_ID_LENGTH), asciiBytes(triple.batchId))).toBe(
          true,
        );
        expect(bytesToBigInt(message.slice(ROOT_OFFSET, ROOT_OFFSET + ROOT_LENGTH))).toBe(triple.merkleRoot);
        const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
        expect(view.getUint32(COUNT_OFFSET, false)).toBe(triple.recordCount);
        expect(COUNT_OFFSET + COUNT_LENGTH).toBe(MESSAGE_LENGTH);
        // The whole message equals the independently built one, and the call is repeatable.
        expect(sameBytes(message, expectedMessage(triple))).toBe(true);
        expect(sameBytes(message, messageOf(triple))).toBe(true);
      }),
    );
  });

  it('digest_message_unambiguous: two different valid triples give messages of equal length that differ', () => {
    runProperty(
      'ledger-format digest_message_unambiguous distinct',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(differentTriplesArb, ([a, b]) => {
        const messageA = messageOf(a);
        const messageB = messageOf(b);
        expect(messageA.length).toBe(messageB.length);
        expect(sameBytes(messageA, messageB)).toBe(false);
      }),
    );
  });

  it('digest_message_unambiguous: a change in one field changes bytes only inside that field', () => {
    const regions = {
      batchId: [BATCH_ID_OFFSET, BATCH_ID_OFFSET + BATCH_ID_LENGTH],
      merkleRoot: [ROOT_OFFSET, ROOT_OFFSET + ROOT_LENGTH],
      recordCount: [COUNT_OFFSET, COUNT_OFFSET + COUNT_LENGTH],
    } as const;
    runProperty(
      'ledger-format digest_message_unambiguous regions',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(oneFieldChangedArb, ({ field, a, b }) => {
        const messageA = messageOf(a);
        const messageB = messageOf(b);
        const [start, end] = regions[field];
        const differing: number[] = [];
        for (let i = 0; i < messageA.length; i += 1) {
          if (messageA[i] !== messageB[i]) differing.push(i);
        }
        expect(differing.length).toBeGreaterThan(0);
        expect(differing.every((i) => i >= start && i < end)).toBe(true);
      }),
    );
  });

  it('digest_message_unambiguous: a batchId that does not match the pattern throws the fixed message', () => {
    runProperty(
      'ledger-format digest_message_unambiguous bad batch id',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(invalidBatchIdArb, validRootArb, validCountArb, (batchId, root, count) => {
        expectFixedThrow(() => callUntyped(batchId, root, count));
      }),
    );
  });

  it('digest_message_unambiguous: a root below 0, at or above FIELD_MODULUS, or not a bigint throws the fixed message', () => {
    runProperty(
      'ledger-format digest_message_unambiguous bad root',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(batchIdArb, invalidRootArb, validCountArb, (batchId, root, count) => {
        expectFixedThrow(() => callUntyped(batchId, root, count));
      }),
    );
  });

  it('digest_message_unambiguous: a count of 0, 65, a non-integer or NaN throws the fixed message', () => {
    runProperty(
      'ledger-format digest_message_unambiguous bad count',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(batchIdArb, validRootArb, invalidCountArb, (batchId, root, count) => {
        expectFixedThrow(() => callUntyped(batchId, root, count));
      }),
    );
  });

  it('digest_message_unambiguous: edge triples (root 0, root FIELD_MODULUS - 1, counts 1 and 64) are accepted, their neighbours are not', () => {
    const id = 'CTB-20261201-001';
    for (const root of [0n, 1n, FIELD_MODULUS - 1n]) {
      for (const count of [1, 64]) {
        const message = messageOf({ batchId: id, merkleRoot: root, recordCount: count });
        expect(sameBytes(message, expectedMessage({ batchId: id, merkleRoot: root, recordCount: count }))).toBe(true);
      }
    }
    expectFixedThrow(() => callUntyped(id, -1n, 1));
    expectFixedThrow(() => callUntyped(id, FIELD_MODULUS, 1));
    expectFixedThrow(() => callUntyped(id, 0n, 0));
    expectFixedThrow(() => callUntyped(id, 0n, 65));
    expectFixedThrow(() => callUntyped(id, 0n, NaN));
    expectFixedThrow(() => callUntyped(id, 0n, 1.5));
    expectFixedThrow(() => callUntyped('CTB-20261201-0010', 0n, 1));
    expectFixedThrow(() => callUntyped('CTB-20261201-001\n', 0n, 1));
  });
});

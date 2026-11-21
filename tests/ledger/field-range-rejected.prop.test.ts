import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS, CAPACITY, FIELD_MODULUS, ID_MAX, SALT_BOUND } from '../../src/ledger/field';
import type { Batch } from '../../src/ledger/batch';
import { BATCH_ID_PATTERN } from '../../src/ledger/batch';
import type { Posting } from '../../src/ledger/posting';
import { parseBatch } from '../../src/ledger/parse';
import { serializeBatch } from '../../src/ledger/serialize';
import { runProperty } from '../support/pbt';
import { captureThrown, expectFormatError, valueForms } from '../support/ledger-asserts';
import {
  FIELD_META,
  RANGE_FIELDS,
  at,
  batchArb,
  batchIdArb,
  batchLines,
  batchText,
  postingArb,
  postingFieldTexts,
  postingLine,
  postingLineFromFields,
  smallBatchArb,
  textFromLines,
} from '../support/ledger-arbitraries';
import type { RangeField } from '../support/ledger-arbitraries';

// Feature: ledger-format, Property field_range_rejected: For all boundary and out-of-range field values, parseBatch and serializeBatch accept exactly the in-range values and reject the rest without wrapping
// **Validates: Requirements 2.4, 3.2, 3.3**
//
// Seed 20262004, 300 runs. Amounts: 2^40 - 1 is accepted. 2^40, 2^40 + 1, the nine values within
// 4 of 2^53, the nine values within 4 of FIELD_MODULUS and negatives are rejected, in both
// `parseBatch` and `serializeBatch`. `recordId` and `account` above ID_MAX and `salt` of
// SALT_BOUND or more are rejected with the *_RANGE codes. The bounds come from `src/ledger/field.ts`.
//
// A value that is wider than its column cannot be written into a line of 131 characters. For
// `parseBatch` it is written at full width, which makes the line too long, and the expected code
// is LINE_WIDTH. A negative value is written with a leading minus sign and expects *_NOT_DIGITS.
// Either way the value is rejected and never wrapped into the column.
//
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262004;
const NUM_RUNS = 300;

const TWO_POW_53 = 2n ** 53n;
const WIDE_LIMIT = 2n ** 300n;

function near(center: bigint, radius: bigint): bigint[] {
  const out: bigint[] = [];
  for (let d = -radius; d <= radius; d += 1n) out.push(center + d);
  return out;
}

/** Boundary values for one field: around its own bound, 2^53, the field modulus, and negatives. */
function boundaryValues(field: RangeField): bigint[] {
  const { max, width } = FIELD_META[field];
  const widthLimit = 10n ** BigInt(width);
  return [
    ...near(max, 4n),
    ...near(max + 1n, 1n),
    ...near(TWO_POW_53, 4n),
    ...near(FIELD_MODULUS, 4n),
    ...near(widthLimit, 1n),
    0n,
    1n,
    max - 1n,
    -1n,
    -2n,
    -max,
    -TWO_POW_53,
    -FIELD_MODULUS,
  ].filter((v, i, all) => all.indexOf(v) === i);
}

/** Values to test for one field: boundaries, values above the bound that still fit the column, and wide values. */
function valueArb(field: RangeField): fc.Arbitrary<bigint> {
  const { max, width } = FIELD_META[field];
  const widthLimit = 10n ** BigInt(width) - 1n;
  const parts: { weight: number; arbitrary: fc.Arbitrary<bigint> }[] = [
    { weight: 6, arbitrary: fc.constantFrom(...boundaryValues(field)) },
    { weight: 3, arbitrary: fc.bigInt({ min: 0n, max }) },
    { weight: 2, arbitrary: fc.bigInt({ min: -WIDE_LIMIT, max: -1n }) },
    { weight: 2, arbitrary: fc.bigInt({ min: 0n, max: WIDE_LIMIT }) },
  ];
  // Only fields whose column can hold a value above the bound get the "fits the column" draw.
  if (max < widthLimit) {
    parts.push({ weight: 4, arbitrary: fc.bigInt({ min: max + 1n, max: widthLimit }) });
  }
  return fc.oneof(...parts);
}

const fieldValueArb: fc.Arbitrary<{ field: RangeField; value: bigint }> = fc
  .constantFrom(...RANGE_FIELDS)
  .chain((field) => valueArb(field).map((value) => ({ field, value })));

/** The column text of a value: zero-padded digits, or a minus sign and zero-padded digits. */
function columnText(value: bigint, width: number): string {
  return value < 0n ? `-${(-value).toString().padStart(width - 1, '0')}` : value.toString().padStart(width, '0');
}

/** A copy of the posting with one field replaced. */
function withField(p: Posting, field: RangeField, value: bigint): Posting {
  return { ...p, [field]: value };
}

function isInRange(field: RangeField, value: bigint): boolean {
  return value >= 0n && value <= FIELD_META[field].max;
}

/** Checks `parseBatch` and `serializeBatch` for one value in one field of one slot. */
function checkValue(batch: Batch, slotDraw: number, field: RangeField, value: bigint): void {
  const slot = slotDraw % batch.postings.length;
  const meta = FIELD_META[field];
  const changedPosting = withField(at(batch.postings, slot), field, value);
  const changedBatch: Batch = {
    batchId: batch.batchId,
    postings: batch.postings.map((p, i) => (i === slot ? changedPosting : p)),
  };
  const line = slot + 2;
  const secrets = valueForms(value);
  const columnKey = field === 'amountCents' ? 'amount' : field;
  const text = columnText(value, meta.width);
  const original = at(batch.postings, slot);
  // The base lines with the one posting line rebuilt, column by column, around the column text.
  const lines = batchLines(batch).map((l, i) =>
    i === slot + 1 ? postingLineFromFields({ ...postingFieldTexts(original), [columnKey]: text }) : l,
  );

  // serializeBatch: in-range values are written as zero-padded text, all others throw.
  const serialized = captureThrown(() => serializeBatch(changedBatch));
  if (isInRange(field, value)) {
    expect(serialized).toBeUndefined();
    const serializedText = serializeBatch(changedBatch);
    expect(serializedText).toBe(textFromLines(lines));
    expect(parseBatch(serializedText)).toStrictEqual(changedBatch);
  } else {
    expectFormatError(serialized, { line, code: meta.rangeCode, secrets });
  }

  // parseBatch: the same value written into the column text of line `line`.
  const parsed = captureThrown(() => parseBatch(textFromLines(lines)));
  if (text.length !== meta.width) {
    expectFormatError(parsed, { line, code: 'LINE_WIDTH', secrets: [...secrets, text] });
  } else if (value < 0n) {
    expectFormatError(parsed, { line, code: meta.notDigitsCode, secrets: [...secrets, text] });
  } else if (value > meta.max) {
    expectFormatError(parsed, { line, code: meta.rangeCode, secrets: [...secrets, text] });
  } else {
    expect(parsed).toBeUndefined();
    expect(parseBatch(textFromLines(lines))).toStrictEqual(changedBatch);
  }
}

describe('field_range_rejected', () => {
  it('field_range_rejected: amounts, ids and salts accept exactly the in-range values', () => {
    runProperty(
      'ledger-format field_range_rejected',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(smallBatchArb, fc.nat(), fieldValueArb, (batch, slotDraw, { field, value }) => {
        checkValue(batch, slotDraw, field, value);
      }),
    );
  });

  it('field_range_rejected: boundary table, every boundary value of every field in the first and last slot', () => {
    const [batch] = fc.sample(
      smallBatchArb.filter((b) => b.postings.length >= 2),
      { seed: SEED, numRuns: 1 },
    );
    if (batch === undefined) throw new Error('NO BATCH SAMPLED');
    for (const field of RANGE_FIELDS) {
      for (const value of boundaryValues(field)) {
        checkValue(batch, 0, field, value);
        checkValue(batch, batch.postings.length - 1, field, value);
      }
    }
  });

  it('field_range_rejected: 2^40 - 1 is accepted and 2^40 is rejected, without wrapping', () => {
    const [batch] = fc.sample(smallBatchArb, { seed: SEED, numRuns: 1 });
    if (batch === undefined) throw new Error('NO BATCH SAMPLED');
    const highest = AMOUNT_BOUND_CENTS - 1n;
    const posting = at(batch.postings, 0);
    const accepted: Batch = {
      batchId: batch.batchId,
      postings: [{ ...posting, amountCents: highest }],
    };
    const parsed = parseBatch(serializeBatch(accepted));
    expect(parsed.postings[0]?.amountCents).toBe(highest);
    for (const amount of [AMOUNT_BOUND_CENTS, AMOUNT_BOUND_CENTS + 1n, FIELD_MODULUS + 1n, -1n]) {
      const rejected: Batch = { batchId: batch.batchId, postings: [{ ...posting, amountCents: amount }] };
      expectFormatError(
        captureThrown(() => serializeBatch(rejected)),
        { line: 2, code: 'AMOUNT_RANGE', secrets: valueForms(amount) },
      );
    }
    // Largest recordId and account, and largest salt, are accepted. One more is rejected.
    const edge: Batch = {
      batchId: batch.batchId,
      postings: [{ ...posting, recordId: ID_MAX, account: ID_MAX, salt: SALT_BOUND - 1n }],
    };
    expect(parseBatch(serializeBatch(edge))).toStrictEqual(edge);
    expectFormatError(
      captureThrown(() => serializeBatch({ ...edge, postings: [{ ...posting, recordId: ID_MAX + 1n }] })),
      { line: 2, code: 'RECORD_ID_RANGE', secrets: valueForms(ID_MAX + 1n) },
    );
    expectFormatError(
      captureThrown(() => serializeBatch({ ...edge, postings: [{ ...posting, account: ID_MAX + 1n }] })),
      { line: 2, code: 'ACCOUNT_RANGE', secrets: valueForms(ID_MAX + 1n) },
    );
    expectFormatError(
      captureThrown(() => serializeBatch({ ...edge, postings: [{ ...posting, salt: SALT_BOUND }] })),
      { line: 2, code: 'SALT_RANGE', secrets: valueForms(SALT_BOUND) },
    );
  });

  it('field_range_rejected: serializeBatch rejects 0 postings, more than 64 postings and a bad batch id with fixed codes', () => {
    const badBatchIdArb: fc.Arbitrary<string> = batchIdArb.chain((id) =>
      fc
        .constantFrom(
          `${id}X`,
          id.slice(0, -1),
          id.toLowerCase(),
          id.replace('CTB', 'CTX'),
          id.replaceAll('-', '_'),
          `${id}\n`,
          ` ${id}`,
          `CTB-91827364-${id.slice(-3)}9`,
          '',
        )
        .filter((s) => !BATCH_ID_PATTERN.test(s)),
    );
    runProperty(
      'ledger-format field_range_rejected structure',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(
        batchArb,
        badBatchIdArb,
        fc.array(postingArb, { minLength: CAPACITY + 1, maxLength: CAPACITY + 6 }),
        (batch, badId, tooMany) => {
          // 0 postings: line 2.
          expectFormatError(
            captureThrown(() => serializeBatch({ batchId: batch.batchId, postings: [] })),
            { line: 2, code: 'ZERO_POSTINGS', secrets: [batch.batchId] },
          );
          // More than 64 postings: line 66.
          expectFormatError(
            captureThrown(() => serializeBatch({ batchId: batch.batchId, postings: tooMany })),
            {
              line: CAPACITY + 2,
              code: 'TOO_MANY_POSTINGS',
              secrets: [batch.batchId, postingLine(at(tooMany, CAPACITY))],
            },
          );
          // A batch id that does not match CTB-YYYYMMDD-NNN: line 1.
          expectFormatError(
            captureThrown(() => serializeBatch({ batchId: badId, postings: batch.postings })),
            { line: 1, code: 'BATCH_ID_FORMAT', secrets: [badId] },
          );
          // Control: the good batch still serializes to its canonical text.
          expect(serializeBatch(batch)).toBe(batchText(batch));
        },
      ),
    );
  });
});

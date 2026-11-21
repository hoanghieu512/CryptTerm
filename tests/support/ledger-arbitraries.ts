// fast-check arbitraries and text builders for the ledger-format property tests
// (ledger-format spec, Requirements 1, 2 and 3).
//
// Used by:
//   roundtrip                tests/ledger/roundtrip.prop.test.ts                 batchArb
//   text_roundtrip           tests/ledger/text-roundtrip.prop.test.ts            validTextArb
//   parser_rejects_malformed tests/ledger/parser-rejects-malformed.prop.test.ts  defectCaseArb
//   field_range_rejected     tests/ledger/field-range-rejected.prop.test.ts      batchArb, line builders
//
// The text builders below write a Batch_File FIELD BY FIELD from the column layout in
// design.md "Data Models > Column layout". They do NOT call `serializeBatch`, and they do not
// import `src/ledger/layout`. The widths are written here as literals on purpose, so that a
// wrong width in the implementation shows up as a test failure and is not copied into the test.
//
// Column layout (1-based starts, widths), every line 131 characters then LF:
//   header   H(1) batchId(16) filler(114)
//   posting  P(1) recordId(20) account(20) side(1) amount(13) flag(1) salt(75)
//   trailer  T(1) batchId(16) count(2) filler(112)
//
// Everything is synthetic. Ids are plain counters, accounts are 12 digits (never a PAN of 13 or
// more digits), and salts are random numbers. Nothing here prints anything.
import fc from 'fast-check';
import { AMOUNT_BOUND_CENTS, CAPACITY, ID_MAX, SALT_BOUND } from '../../src/ledger/field';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from '../../src/ledger/posting';
import type { Posting, ReviewFlag, Side } from '../../src/ledger/posting';
import type { Batch } from '../../src/ledger/batch';

// ---------------------------------------------------------------------------------------------
// Column layout, written as literals (design.md "Column layout")
// ---------------------------------------------------------------------------------------------

export const WIDTHS = {
  tag: 1,
  batchId: 16,
  headerFiller: 114,
  recordId: 20,
  account: 20,
  side: 1,
  amount: 13,
  flag: 1,
  salt: 75,
  count: 2,
  trailerFiller: 112,
} as const;

/** The line width of all three record types, as a literal (not read from `layout.ts`). */
export const LITERAL_LINE_WIDTH = 131;

/** Sum of the widths of one record type, for the layout check in `text_roundtrip`. */
export const LITERAL_SUMS = {
  header: WIDTHS.tag + WIDTHS.batchId + WIDTHS.headerFiller,
  posting:
    WIDTHS.tag +
    WIDTHS.recordId +
    WIDTHS.account +
    WIDTHS.side +
    WIDTHS.amount +
    WIDTHS.flag +
    WIDTHS.salt,
  trailer: WIDTHS.tag + WIDTHS.batchId + WIDTHS.count + WIDTHS.trailerFiller,
} as const;

/** Distinctive digit string planted into rejected lines. Never a valid value on its own. */
export const SENTINEL = '918273645';

// ---------------------------------------------------------------------------------------------
// Field-by-field text builders (not `serializeBatch`)
// ---------------------------------------------------------------------------------------------

/** The text of each column of a posting line, before they are joined. */
export interface PostingFieldTexts {
  readonly recordId: string;
  readonly account: string;
  readonly side: string;
  readonly amount: string;
  readonly flag: string;
  readonly salt: string;
}

/** Zero-padded, right-aligned digits. Throws if the value is negative or too wide. */
export function padDigits(value: bigint, width: number): string {
  if (value < 0n) throw new Error('FIXTURE VALUE NEGATIVE');
  const text = value.toString().padStart(width, '0');
  if (text.length !== width) throw new Error('FIXTURE VALUE TOO WIDE');
  return text;
}

export function sideLetter(side: Side): 'D' | 'C' {
  return side === SIDE_DEBIT ? 'D' : 'C';
}

export function flagLetter(flag: ReviewFlag): 'Y' | 'N' {
  return flag === FLAG_YES ? 'Y' : 'N';
}

/** The column texts of a valid posting. */
export function postingFieldTexts(p: Posting): PostingFieldTexts {
  return {
    recordId: padDigits(p.recordId, WIDTHS.recordId),
    account: padDigits(p.account, WIDTHS.account),
    side: sideLetter(p.side),
    amount: padDigits(p.amountCents, WIDTHS.amount),
    flag: flagLetter(p.reviewFlag),
    salt: padDigits(p.salt, WIDTHS.salt),
  };
}

/** Joins column texts into a posting line. No padding and no checks, so defects can be planted. */
export function postingLineFromFields(f: PostingFieldTexts): string {
  return `P${f.recordId}${f.account}${f.side}${f.amount}${f.flag}${f.salt}`;
}

export function postingLine(p: Posting): string {
  return postingLineFromFields(postingFieldTexts(p));
}

export function headerLine(batchId: string): string {
  return `H${batchId}${' '.repeat(WIDTHS.headerFiller)}`;
}

/** `countText` is the two count characters. */
export function trailerLineFromText(batchId: string, countText: string): string {
  return `T${batchId}${countText}${' '.repeat(WIDTHS.trailerFiller)}`;
}

/** A count is a number of postings, not money. */
export function trailerLine(batchId: string, count: number): string {
  return trailerLineFromText(batchId, String(count).padStart(WIDTHS.count, '0'));
}

/** Header, postings in order, trailer. No LF. */
export function batchLines(batch: Batch): string[] {
  return [
    headerLine(batch.batchId),
    ...batch.postings.map(postingLine),
    trailerLine(batch.batchId, batch.postings.length),
  ];
}

/** Lines joined with LF, ending with a final LF. */
export function textFromLines(lines: readonly string[]): string {
  return `${lines.join('\n')}\n`;
}

/** The canonical text of a valid batch, built field by field. */
export function batchText(batch: Batch): string {
  return textFromLines(batchLines(batch));
}

/** Returns the element, or throws. Keeps `noUncheckedIndexedAccess` quiet without a cast. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error('FIXTURE INDEX OUT OF RANGE');
  return item;
}

// ---------------------------------------------------------------------------------------------
// Valid postings and batches
// ---------------------------------------------------------------------------------------------

const MAX_CENTS: bigint = AMOUNT_BOUND_CENTS - 1n;

const sideArb: fc.Arbitrary<Side> = fc.constantFrom<Side>(SIDE_DEBIT, SIDE_CREDIT);
const flagArb: fc.Arbitrary<ReviewFlag> = fc.constantFrom<ReviewFlag>(FLAG_NO, FLAG_YES);

/** recordId or account: 0 to ID_MAX, boundary values boosted. */
const idArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, ID_MAX - 1n, ID_MAX) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 999_999n }) },
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: ID_MAX }) },
);

/** Amount in cents: 0 to 2^40 - 1, boundary values boosted. */
export const amountArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, MAX_CENTS - 1n, MAX_CENTS) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 1_000_000n }) },
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: MAX_CENTS }) },
);

/** Salt: 0 to 2^248 - 1, boundary values boosted. */
const saltArb: fc.Arbitrary<bigint> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom<bigint>(0n, 1n, SALT_BOUND - 1n) },
  { weight: 3, arbitrary: fc.bigInt({ min: 0n, max: 2n ** 24n }) },
  { weight: 5, arbitrary: fc.bigInt({ min: 0n, max: SALT_BOUND - 1n }) },
);

/**
 * A posting with every field in range. The batch is not required to balance: the format layer
 * does not check invariants.
 */
export const postingArb: fc.Arbitrary<Posting> = fc
  .record<Posting>({
    recordId: idArb,
    account: idArb,
    side: sideArb,
    amountCents: amountArb,
    reviewFlag: flagArb,
    salt: saltArb,
  })
  // fast-check 4 builds records with a null prototype, which `toStrictEqual` tells apart from a
  // plain object. Spreading gives the plain object that the parser returns.
  .map((p): Posting => ({ ...p }));

/** `CTB-YYYYMMDD-NNN`: `CTB-` + 8 digits + `-` + 3 digits. The digits are a label, not a date. */
export const batchIdArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 99_999_999 }), fc.integer({ min: 0, max: 999 }))
  .map(([label, serial]) => `CTB-${String(label).padStart(8, '0')}-${String(serial).padStart(3, '0')}`);

/** Valid batches with 1 to 64 postings, the two ends (1 and 64) boosted. */
export const batchArb: fc.Arbitrary<Batch> = fc
  .tuple(
    batchIdArb,
    fc.oneof(
      // `size: 'max'` makes lengths range over the whole span (see zk-arbitraries.ts).
      { weight: 6, arbitrary: fc.array(postingArb, { minLength: 1, maxLength: CAPACITY, size: 'max' }) },
      { weight: 1, arbitrary: fc.array(postingArb, { minLength: 1, maxLength: 1 }) },
      { weight: 1, arbitrary: fc.array(postingArb, { minLength: CAPACITY, maxLength: CAPACITY }) },
    ),
  )
  .map(([batchId, postings]): Batch => ({ batchId, postings }));

/** A small valid batch (1 to 4 postings), for tests that plant one defect in one line. */
export const smallBatchArb: fc.Arbitrary<Batch> = fc
  .tuple(batchIdArb, fc.array(postingArb, { minLength: 1, maxLength: 4 }))
  .map(([batchId, postings]): Batch => ({ batchId, postings }));

/** Valid Batch_File text built field by field, with the batch it was built from. */
export interface ValidText {
  readonly text: string;
  readonly batch: Batch;
}

export const validTextArb: fc.Arbitrary<ValidText> = batchArb.map((batch) => ({
  text: batchText(batch),
  batch,
}));

// ---------------------------------------------------------------------------------------------
// Defective texts
// ---------------------------------------------------------------------------------------------

export const DEFECT_CLASSES = [
  'wrongLineWidth',
  'amountNotDigits',
  'amountRange',
  'countMismatch',
  'batchIdMismatch',
  'sideInvalid',
  'flagInvalid',
  'tooManyPostings',
  'zeroPostings',
  'missingHeader',
  'missingTrailer',
  'crlf',
] as const;
export type DefectClass = (typeof DEFECT_CLASSES)[number];

/** The reason code of each defect (design.md "Parse order" table). All twelve differ. */
export const DEFECT_CODES: Readonly<Record<DefectClass, string>> = {
  wrongLineWidth: 'LINE_WIDTH',
  amountNotDigits: 'AMOUNT_NOT_DIGITS',
  amountRange: 'AMOUNT_RANGE',
  countMismatch: 'COUNT_MISMATCH',
  batchIdMismatch: 'BATCH_ID_MISMATCH',
  sideInvalid: 'SIDE_INVALID',
  flagInvalid: 'FLAG_INVALID',
  tooManyPostings: 'TOO_MANY_POSTINGS',
  zeroPostings: 'ZERO_POSTINGS',
  missingHeader: 'MISSING_HEADER',
  missingTrailer: 'MISSING_TRAILER',
  crlf: 'CR_IN_LINE',
};

/** Valid text with one planted defect, the expected 1-based line and code, and the planted values. */
export interface DefectCase {
  readonly defect: DefectClass;
  readonly text: string;
  readonly line: number;
  readonly code: string;
  /** Strings from the rejected line that no error text may contain (filtered to 8+ characters by the test). */
  readonly secrets: readonly string[];
}

/** Values of the rejected line that the error must not repeat: the whole line and its columns. */
function lineSecrets(line: string, batchId: string): string[] {
  const secrets = [batchId, line.trimEnd()];
  if (line.startsWith('P') && line.length === LITERAL_LINE_WIDTH) {
    secrets.push(line.slice(1, 21), line.slice(21, 41), line.slice(42, 55), line.slice(56, 131));
  }
  return secrets;
}

/** Replaces one element of an array, as a new array. */
function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

const NON_DIGIT_AMOUNT_CHARS = ['-', '+', '.', 'e', 'E', 'x', ' ', '$', ',', 'a'] as const;
const BAD_SIDE_CHARS = ['d', 'c', 'X', 'Y', 'N', '0', '1', ' ', '?', '-'] as const;
const BAD_FLAG_CHARS = ['y', 'n', 'D', 'C', '1', '0', ' ', '?', 'X'] as const;

/** A valid amount column that carries the sentinel digits (value 918273645 cents, in range). */
const SENTINEL_AMOUNT_TEXT = SENTINEL.padStart(WIDTHS.amount, '0');

/** A posting line whose amount column carries the sentinel, with `mutate` applied to the columns. */
function sentinelPostingLine(p: Posting, mutate: (f: PostingFieldTexts) => PostingFieldTexts): string {
  return postingLineFromFields(mutate({ ...postingFieldTexts(p), amount: SENTINEL_AMOUNT_TEXT }));
}

function makeCase(
  defect: DefectClass,
  lines: readonly string[],
  line: number,
  secrets: readonly string[],
): DefectCase {
  return { defect, text: textFromLines(lines), line, code: DEFECT_CODES[defect], secrets };
}

/** Index of a posting line inside `batchLines(batch)` for a free `slot` draw. */
function pickSlot(batch: Batch, slotDraw: number): number {
  return slotDraw % batch.postings.length;
}

/** Wrong width: one line is cut to 1..130 characters, or extended by the sentinel digits. */
const wrongLineWidthArb: fc.Arbitrary<DefectCase> = fc
  .tuple(
    batchArb,
    fc.nat(),
    fc.oneof(
      fc.record({ kind: fc.constant('truncate' as const), keep: fc.integer({ min: 1, max: 130 }) }),
      fc.record({ kind: fc.constant('extend' as const), keep: fc.integer({ min: 0, max: 4 }) }),
    ),
  )
  .map(([batch, lineDraw, how]) => {
    const lines = batchLines(batch);
    const index = lineDraw % lines.length;
    const original = at(lines, index);
    const changed =
      how.kind === 'truncate' ? original.slice(0, how.keep) : `${original}${SENTINEL}${'7'.repeat(how.keep)}`;
    return makeCase(
      'wrongLineWidth',
      replaceAt(lines, index, changed),
      index + 1,
      [...lineSecrets(original, batch.batchId), SENTINEL],
    );
  });

/** A non-digit character inside the 13-character amount column, next to the sentinel digits. */
const amountNotDigitsArb: fc.Arbitrary<DefectCase> = fc
  .tuple(
    batchArb,
    fc.nat(),
    fc.constantFrom(...NON_DIGIT_AMOUNT_CHARS),
    fc.integer({ min: 0, max: 3 }),
  )
  .map(([batch, slotDraw, bad, zerosBefore]) => {
    const slot = pickSlot(batch, slotDraw);
    const amount = `${'0'.repeat(zerosBefore)}${SENTINEL}${bad}${'0'.repeat(3 - zerosBefore)}`;
    const original = postingLine(at(batch.postings, slot));
    const changed = postingLineFromFields({ ...postingFieldTexts(at(batch.postings, slot)), amount });
    const lines = replaceAt(batchLines(batch), slot + 1, changed);
    return makeCase('amountNotDigits', lines, slot + 2, [
      ...lineSecrets(original, batch.batchId),
      SENTINEL,
      amount,
    ]);
  });

/** An amount of 2^40 or more that still fits the 13-character column. */
const amountRangeArb: fc.Arbitrary<DefectCase> = fc
  .tuple(
    batchArb,
    fc.nat(),
    fc.oneof(
      { weight: 3, arbitrary: fc.integer({ min: 0, max: 9999 }).map((tail) => BigInt(`${SENTINEL}${String(tail).padStart(4, '0')}`)) },
      { weight: 1, arbitrary: fc.constantFrom<bigint>(AMOUNT_BOUND_CENTS, AMOUNT_BOUND_CENTS + 1n, 10n ** 13n - 1n) },
    ),
  )
  .map(([batch, slotDraw, value]) => {
    const slot = pickSlot(batch, slotDraw);
    const amount = padDigits(value, WIDTHS.amount);
    const original = postingLine(at(batch.postings, slot));
    const changed = postingLineFromFields({ ...postingFieldTexts(at(batch.postings, slot)), amount });
    const lines = replaceAt(batchLines(batch), slot + 1, changed);
    return makeCase('amountRange', lines, slot + 2, [...lineSecrets(original, batch.batchId), amount]);
  });

/** The trailer count differs from the number of posting lines. */
const countMismatchArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.integer({ min: 0, max: 99 }))
  .map(([batch, draw]) => {
    const n = batch.postings.length;
    const count = draw === n ? (draw + 1) % 100 : draw;
    const lines = replaceAt(
      batchLines(batch),
      n + 1,
      trailerLine(batch.batchId, count),
    );
    return makeCase('countMismatch', lines, n + 2, [batch.batchId]);
  });

/** The trailer batch id is valid in format but differs from the header id. */
const batchIdMismatchArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.integer({ min: 0, max: 999 }))
  .map(([batch, serial]) => {
    const planted = `CTB-${SENTINEL.slice(0, 8)}-${String(serial).padStart(3, '0')}`;
    const other = planted === batch.batchId ? `CTB-${SENTINEL.slice(0, 8)}-${serial === 0 ? '001' : '000'}` : planted;
    const n = batch.postings.length;
    const lines = replaceAt(batchLines(batch), n + 1, trailerLine(other, n));
    return makeCase('batchIdMismatch', lines, n + 2, [batch.batchId, other, SENTINEL.slice(0, 8)]);
  });

/** A side column that is not D or C, lowercase included, next to a sentinel amount. */
const sideInvalidArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.nat(), fc.constantFrom(...BAD_SIDE_CHARS))
  .map(([batch, slotDraw, bad]) => {
    const slot = pickSlot(batch, slotDraw);
    const posting = at(batch.postings, slot);
    const changed = sentinelPostingLine(posting, (f) => ({ ...f, side: bad }));
    const lines = replaceAt(batchLines(batch), slot + 1, changed);
    return makeCase('sideInvalid', lines, slot + 2, [
      ...lineSecrets(changed, batch.batchId),
      ...lineSecrets(postingLine(posting), batch.batchId),
      SENTINEL,
    ]);
  });

/** A flag column that is not Y or N, lowercase included, next to a sentinel amount. */
const flagInvalidArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.nat(), fc.constantFrom(...BAD_FLAG_CHARS))
  .map(([batch, slotDraw, bad]) => {
    const slot = pickSlot(batch, slotDraw);
    const posting = at(batch.postings, slot);
    const changed = sentinelPostingLine(posting, (f) => ({ ...f, flag: bad }));
    const lines = replaceAt(batchLines(batch), slot + 1, changed);
    return makeCase('flagInvalid', lines, slot + 2, [
      ...lineSecrets(changed, batch.batchId),
      ...lineSecrets(postingLine(posting), batch.batchId),
      SENTINEL,
    ]);
  });

/** 65 to 70 postings. The trailer count matches, so only the capacity rule can fire. Line 66. */
const tooManyPostingsArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchIdArb, fc.array(postingArb, { minLength: CAPACITY + 1, maxLength: CAPACITY + 6 }))
  .map(([batchId, postings]) => {
    const batch: Batch = { batchId, postings };
    const lines = batchLines(batch);
    return makeCase('tooManyPostings', lines, CAPACITY + 2, lineSecrets(at(lines, CAPACITY + 1), batchId));
  });

/** Header directly followed by the trailer, count 00. Line 2. */
const zeroPostingsArb: fc.Arbitrary<DefectCase> = batchIdArb.map((batchId) =>
  makeCase('zeroPostings', [headerLine(batchId), trailerLine(batchId, 0)], 2, [batchId]),
);

/** Header removed, or its tag replaced. Line 1. */
const missingHeaderArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.constantFrom('remove', 'P', 'T', 'X', 'h'))
  .map(([batch, how]) => {
    const lines = batchLines(batch);
    const rest = lines.slice(1);
    const changed = how === 'remove' ? rest : [`${how}${at(lines, 0).slice(1)}`, ...rest];
    return makeCase('missingHeader', changed, 1, [batch.batchId]);
  });

/** Trailer removed (error on the new last line), or its tag replaced (error on the trailer line). */
const missingTrailerArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.constantFrom('remove', 'P', 'H', 'X', 't'))
  .map(([batch, how]) => {
    const lines = batchLines(batch);
    const n = batch.postings.length;
    if (how === 'remove') {
      return makeCase('missingTrailer', lines.slice(0, -1), n + 1, [batch.batchId]);
    }
    const changed = replaceAt(lines, n + 1, `${how}${at(lines, n + 1).slice(1)}`);
    return makeCase('missingTrailer', changed, n + 2, [batch.batchId]);
  });

/** CRLF line ends on every line (error on line 1) or on one line (error on that line). */
const crlfArb: fc.Arbitrary<DefectCase> = fc
  .tuple(batchArb, fc.boolean(), fc.nat())
  .map(([batch, all, lineDraw]) => {
    const lines = batchLines(batch);
    if (all) {
      return {
        defect: 'crlf' as const,
        text: `${lines.join('\r\n')}\r\n`,
        line: 1,
        code: DEFECT_CODES.crlf,
        secrets: [batch.batchId],
      };
    }
    const index = lineDraw % lines.length;
    return makeCase('crlf', replaceAt(lines, index, `${at(lines, index)}\r`), index + 1, [batch.batchId]);
  });

const DEFECT_ARBS: Readonly<Record<DefectClass, fc.Arbitrary<DefectCase>>> = {
  wrongLineWidth: wrongLineWidthArb,
  amountNotDigits: amountNotDigitsArb,
  amountRange: amountRangeArb,
  countMismatch: countMismatchArb,
  batchIdMismatch: batchIdMismatchArb,
  sideInvalid: sideInvalidArb,
  flagInvalid: flagInvalidArb,
  tooManyPostings: tooManyPostingsArb,
  zeroPostings: zeroPostingsArb,
  missingHeader: missingHeaderArb,
  missingTrailer: missingTrailerArb,
  crlf: crlfArb,
};

/** One defect class. */
export function defectCaseArbFor(defect: DefectClass): fc.Arbitrary<DefectCase> {
  return DEFECT_ARBS[defect];
}

/** Any defect class, evenly. */
export const defectCaseArb: fc.Arbitrary<DefectCase> = fc
  .constantFrom(...DEFECT_CLASSES)
  .chain((defect) => defectCaseArbFor(defect));

// ---------------------------------------------------------------------------------------------
// Field values for the range test
// ---------------------------------------------------------------------------------------------

export const RANGE_FIELDS = ['recordId', 'account', 'amountCents', 'salt'] as const;
export type RangeField = (typeof RANGE_FIELDS)[number];

/** Column width, largest accepted value and reason codes of each range-checked field. */
export const FIELD_META: Readonly<
  Record<RangeField, { width: number; max: bigint; rangeCode: string; notDigitsCode: string }>
> = {
  recordId: { width: WIDTHS.recordId, max: ID_MAX, rangeCode: 'RECORD_ID_RANGE', notDigitsCode: 'RECORD_ID_NOT_DIGITS' },
  account: { width: WIDTHS.account, max: ID_MAX, rangeCode: 'ACCOUNT_RANGE', notDigitsCode: 'ACCOUNT_NOT_DIGITS' },
  amountCents: { width: WIDTHS.amount, max: MAX_CENTS, rangeCode: 'AMOUNT_RANGE', notDigitsCode: 'AMOUNT_NOT_DIGITS' },
  salt: { width: WIDTHS.salt, max: SALT_BOUND - 1n, rangeCode: 'SALT_RANGE', notDigitsCode: 'SALT_NOT_DIGITS' },
};

// Batch_File serializer (ledger-format design.md "Column layout"). Writes the one canonical text
// of a batch: zero-padded, right-aligned digits and uppercase letters. Throws `BatchFormatError`
// with the codes marked "S" in the design table. `line` is the line the defect would take in the
// output (slot + 2 for a posting). The error never holds a field value.
import { BATCH_ID_PATTERN, BatchFormatError } from './batch';
import type { Batch, BatchFormatCode } from './batch';
import { AMOUNT_BOUND_CENTS, CAPACITY, ID_MAX, SALT_BOUND } from './field';
import {
  FILLER_CHAR,
  FLAG_NO_LETTER,
  FLAG_YES_LETTER,
  HEADER_COLUMNS,
  POSTING_COLUMNS,
  SIDE_CREDIT_LETTER,
  SIDE_DEBIT_LETTER,
  TAG_HEADER,
  TAG_POSTING,
  TAG_TRAILER,
  TRAILER_COLUMNS,
  padDigits,
} from './layout';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from './posting';
import type { Posting } from './posting';

/** Digits of a bigint in `[0, bound)`, or throws `code` for `line`. Non-bigint values are rejected too. */
function digitsBelow(value: unknown, bound: bigint, width: number, code: BatchFormatCode, line: number): string {
  if (typeof value !== 'bigint' || value < 0n || value >= bound) throw new BatchFormatError(code, line);
  return padDigits(value, width);
}

function sideLetter(value: unknown, line: number): string {
  if (value === SIDE_DEBIT) return SIDE_DEBIT_LETTER;
  if (value === SIDE_CREDIT) return SIDE_CREDIT_LETTER;
  throw new BatchFormatError('SIDE_INVALID', line);
}

function flagLetter(value: unknown, line: number): string {
  if (value === FLAG_NO) return FLAG_NO_LETTER;
  if (value === FLAG_YES) return FLAG_YES_LETTER;
  throw new BatchFormatError('FLAG_INVALID', line);
}

/** One posting line, columns left to right. */
function postingLine(p: Posting, line: number): string {
  const recordId = digitsBelow(p.recordId, ID_MAX + 1n, POSTING_COLUMNS.recordId.width, 'RECORD_ID_RANGE', line);
  const account = digitsBelow(p.account, ID_MAX + 1n, POSTING_COLUMNS.account.width, 'ACCOUNT_RANGE', line);
  const side = sideLetter(p.side, line);
  const amount = digitsBelow(p.amountCents, AMOUNT_BOUND_CENTS, POSTING_COLUMNS.amount.width, 'AMOUNT_RANGE', line);
  const flag = flagLetter(p.reviewFlag, line);
  const salt = digitsBelow(p.salt, SALT_BOUND, POSTING_COLUMNS.salt.width, 'SALT_RANGE', line);
  return `${TAG_POSTING}${recordId}${account}${side}${amount}${flag}${salt}`;
}

/**
 * Serializes a `Batch` to its canonical Batch_File text (LF-terminated lines, final LF).
 * Throws `BatchFormatError` for a bad batch id, zero postings, more than 64 postings, or a
 * posting field out of range.
 */
export function serializeBatch(batch: Batch): string {
  if (typeof batch.batchId !== 'string' || !BATCH_ID_PATTERN.test(batch.batchId)) {
    throw new BatchFormatError('BATCH_ID_FORMAT', 1);
  }
  const count = batch.postings.length;
  if (count === 0) throw new BatchFormatError('ZERO_POSTINGS', 2);
  if (count > CAPACITY) throw new BatchFormatError('TOO_MANY_POSTINGS', CAPACITY + 2);

  const lines: string[] = [];
  lines.push(`${TAG_HEADER}${batch.batchId}${FILLER_CHAR.repeat(HEADER_COLUMNS.filler.width)}`);
  batch.postings.forEach((posting, slot) => {
    lines.push(postingLine(posting, slot + 2));
  });
  const countText = padDigits(BigInt(count), TRAILER_COLUMNS.count.width);
  lines.push(`${TAG_TRAILER}${batch.batchId}${countText}${FILLER_CHAR.repeat(TRAILER_COLUMNS.filler.width)}`);
  return `${lines.join('\n')}\n`;
}

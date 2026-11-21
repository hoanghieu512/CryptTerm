// Batch_File parser (ledger-format design.md "Parse order" and the BatchFormatError code table).
//
// Numbers are read by a digit walk over char codes 48 to 57 and then `BigInt(text)`. There is no
// float or `Number` conversion. Only the canonical text is accepted. The first defect found is
// thrown, and the error holds the line and the reason code, never a field value.
import { BATCH_ID_PATTERN, BatchFormatError } from './batch';
import type { Batch, BatchFormatCode } from './batch';
import { AMOUNT_BOUND_CENTS, CAPACITY, ID_MAX, SALT_BOUND } from './field';
import {
  FILLER_CHAR,
  FLAG_NO_LETTER,
  FLAG_YES_LETTER,
  HEADER_COLUMNS,
  LINE_WIDTH,
  POSTING_COLUMNS,
  SIDE_CREDIT_LETTER,
  SIDE_DEBIT_LETTER,
  TAG_HEADER,
  TAG_POSTING,
  TAG_TRAILER,
  TRAILER_COLUMNS,
  columnText,
  padDigits,
} from './layout';
import type { Column } from './layout';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from './posting';
import type { Posting, ReviewFlag, Side } from './posting';

const CHAR_0 = 48;
const CHAR_9 = 57;
const CHAR_SPACE = 0x20;
const CHAR_TILDE = 0x7e;

/** True if every character of `text` is a digit (char codes 48 to 57). */
function isDigits(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c < CHAR_0 || c > CHAR_9) return false;
  }
  return true;
}

/** Reads a digit-only column into a `bigint`, or throws `notDigits` for line `line`. */
function readBigint(text: string, line: number, notDigits: BatchFormatCode): bigint {
  if (text.length === 0 || !isDigits(text)) throw new BatchFormatError(notDigits, line);
  return BigInt(text);
}

function checkFiller(lineText: string, column: Column, line: number): void {
  const text = columnText(lineText, column);
  for (let i = 0; i < text.length; i += 1) {
    if (text.charAt(i) !== FILLER_CHAR) throw new BatchFormatError('FILLER_NOT_SPACE', line);
  }
}

/** Step 2: per line, in line order: CR, width, then characters outside 0x20 to 0x7E. */
function checkLines(lines: readonly string[]): void {
  lines.forEach((text, index) => {
    const line = index + 1;
    if (text.includes('\r')) throw new BatchFormatError('CR_IN_LINE', line);
    if (text.length !== LINE_WIDTH) throw new BatchFormatError('LINE_WIDTH', line);
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      if (c < CHAR_SPACE || c > CHAR_TILDE) throw new BatchFormatError('NON_ASCII_CHAR', line);
    }
  });
}

/** Step 3: header, trailer, middle tags, posting count. */
function checkStructure(lines: readonly string[]): void {
  const last = lines.length;
  if (lines[0]?.charAt(0) !== TAG_HEADER) throw new BatchFormatError('MISSING_HEADER', 1);
  if (lines[last - 1]?.charAt(0) !== TAG_TRAILER) throw new BatchFormatError('MISSING_TRAILER', last);
  for (let i = 1; i < last - 1; i += 1) {
    if (lines[i]?.charAt(0) !== TAG_POSTING) throw new BatchFormatError('RECORD_TAG', i + 1);
  }
  const count = last - 2;
  if (count === 0) throw new BatchFormatError('ZERO_POSTINGS', 2);
  if (count > CAPACITY) throw new BatchFormatError('TOO_MANY_POSTINGS', CAPACITY + 2);
}

function readBatchId(lineText: string, column: Column, line: number): string {
  const id = columnText(lineText, column);
  if (!BATCH_ID_PATTERN.test(id)) throw new BatchFormatError('BATCH_ID_FORMAT', line);
  return id;
}

function readSide(letter: string, line: number): Side {
  if (letter === SIDE_DEBIT_LETTER) return SIDE_DEBIT;
  if (letter === SIDE_CREDIT_LETTER) return SIDE_CREDIT;
  throw new BatchFormatError('SIDE_INVALID', line);
}

function readFlag(letter: string, line: number): ReviewFlag {
  if (letter === FLAG_NO_LETTER) return FLAG_NO;
  if (letter === FLAG_YES_LETTER) return FLAG_YES;
  throw new BatchFormatError('FLAG_INVALID', line);
}

/** Step 4 for one posting line: columns left to right, digit check then range check. */
function parsePostingLine(text: string, line: number): Posting {
  const recordId = readBigint(columnText(text, POSTING_COLUMNS.recordId), line, 'RECORD_ID_NOT_DIGITS');
  if (recordId > ID_MAX) throw new BatchFormatError('RECORD_ID_RANGE', line);
  const account = readBigint(columnText(text, POSTING_COLUMNS.account), line, 'ACCOUNT_NOT_DIGITS');
  if (account > ID_MAX) throw new BatchFormatError('ACCOUNT_RANGE', line);
  const side = readSide(columnText(text, POSTING_COLUMNS.side), line);
  const amountCents = readBigint(columnText(text, POSTING_COLUMNS.amount), line, 'AMOUNT_NOT_DIGITS');
  if (amountCents >= AMOUNT_BOUND_CENTS) throw new BatchFormatError('AMOUNT_RANGE', line);
  const reviewFlag = readFlag(columnText(text, POSTING_COLUMNS.flag), line);
  const salt = readBigint(columnText(text, POSTING_COLUMNS.salt), line, 'SALT_NOT_DIGITS');
  if (salt >= SALT_BOUND) throw new BatchFormatError('SALT_RANGE', line);
  return { recordId, account, side, amountCents, reviewFlag, salt };
}

/**
 * Parses Batch_File text into a `Batch`. Throws `BatchFormatError` for the first defect found.
 * Only canonical text is accepted, so `serializeBatch(parseBatch(t)) === t`.
 */
export function parseBatch(text: string): Batch {
  // Step 1.
  if (text.length === 0) throw new BatchFormatError('MISSING_HEADER', 1);
  const lines = text.split('\n');
  if (lines[lines.length - 1] !== '') throw new BatchFormatError('NO_FINAL_LF', lines.length);
  lines.pop();

  checkLines(lines); // step 2
  checkStructure(lines); // step 3

  // Step 4, line by line.
  const header = lines[0] ?? '';
  const batchId = readBatchId(header, HEADER_COLUMNS.batchId, 1);
  checkFiller(header, HEADER_COLUMNS.filler, 1);

  const postings: Posting[] = [];
  for (let i = 1; i < lines.length - 1; i += 1) {
    postings.push(parsePostingLine(lines[i] ?? '', i + 1));
  }

  const trailerLine = lines.length;
  const trailer = lines[trailerLine - 1] ?? '';
  const trailerId = readBatchId(trailer, TRAILER_COLUMNS.batchId, trailerLine);
  const countText = columnText(trailer, TRAILER_COLUMNS.count);
  if (!isDigits(countText)) throw new BatchFormatError('COUNT_NOT_DIGITS', trailerLine);
  checkFiller(trailer, TRAILER_COLUMNS.filler, trailerLine);

  // Step 5.
  if (trailerId !== batchId) throw new BatchFormatError('BATCH_ID_MISMATCH', trailerLine);
  if (countText !== padDigits(BigInt(postings.length), TRAILER_COLUMNS.count.width)) {
    throw new BatchFormatError('COUNT_MISMATCH', trailerLine);
  }

  return { batchId, postings };
}

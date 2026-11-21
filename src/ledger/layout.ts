// Column layout of the Batch_File. The ONLY place with column numbers, widths and tags
// (ledger-format design.md "Column layout"). `parse.ts` and `serialize.ts` read it from here.
//
// Every record is LINE_WIDTH characters, then one LF. Starts are 1-based, as in the design table.
// The widths come from the bounds: ID_MAX has 20 digits, 2^40 - 1 has 13, 2^248 - 1 has 75, and
// the largest posting count (64) has 2.

/** Characters per line, without the LF. */
export const LINE_WIDTH = 131;

export const TAG_HEADER = 'H';
export const TAG_POSTING = 'P';
export const TAG_TRAILER = 'T';

export const SIDE_DEBIT_LETTER = 'D';
export const SIDE_CREDIT_LETTER = 'C';
export const FLAG_NO_LETTER = 'N';
export const FLAG_YES_LETTER = 'Y';

export const FILLER_CHAR = ' ';

/** One column: 1-based start and width in characters. */
export interface Column {
  readonly start: number;
  readonly width: number;
}

function col(start: number, width: number): Column {
  return Object.freeze({ start, width });
}

/** Header: `H`, batch id, filler. */
export const HEADER_COLUMNS = Object.freeze({
  tag: col(1, 1),
  batchId: col(2, 16),
  filler: col(18, 114),
});

/** Posting: `P`, record id, account, side, amount, flag, salt. */
export const POSTING_COLUMNS = Object.freeze({
  tag: col(1, 1),
  recordId: col(2, 20),
  account: col(22, 20),
  side: col(42, 1),
  amount: col(43, 13),
  flag: col(56, 1),
  salt: col(57, 75),
});

/** Trailer: `T`, batch id, posting count, filler. */
export const TRAILER_COLUMNS = Object.freeze({
  tag: col(1, 1),
  batchId: col(2, 16),
  count: col(18, 2),
  filler: col(20, 112),
});

/** Text of a column in a line. */
export function columnText(line: string, column: Column): string {
  return line.slice(column.start - 1, column.start - 1 + column.width);
}

/** Digits of `value`, zero-padded on the left to `width`. `value` must be a non-negative bigint. */
export function padDigits(value: bigint, width: number): string {
  return value.toString().padStart(width, '0');
}

// Self-check at load: each record's columns are contiguous and fill LINE_WIDTH exactly.
function assertContiguous(columns: Readonly<Record<string, Column>>): void {
  let next = 1;
  for (const column of Object.values(columns)) {
    if (column.start !== next) throw new Error('LAYOUT NOT CONTIGUOUS');
    next += column.width;
  }
  if (next !== LINE_WIDTH + 1) throw new Error('LAYOUT WIDTH MISMATCH');
}
assertContiguous(HEADER_COLUMNS);
assertContiguous(POSTING_COLUMNS);
assertContiguous(TRAILER_COLUMNS);

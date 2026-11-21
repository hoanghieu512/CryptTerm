// The Batch type, the batch id pattern and the error class of the batch codec
// (ledger-format design.md "Batch id format" and the BatchFormatError code table).
import type { Posting } from './posting';

/** A batch: its id and its postings in slot order. */
export interface Batch {
  readonly batchId: string;
  readonly postings: Posting[];
}

/** `CTB-YYYYMMDD-NNN`, 16 ASCII characters. The digits are a label and are not a calendar date. */
export const BATCH_ID_PATTERN = /^CTB-[0-9]{8}-[0-9]{3}$/;

/** Reason codes of `BatchFormatError`. Parser and serializer codes, one per defect. */
export const BATCH_FORMAT_CODES = [
  'MISSING_HEADER',
  'MISSING_TRAILER',
  'NO_FINAL_LF',
  'CR_IN_LINE',
  'LINE_WIDTH',
  'NON_ASCII_CHAR',
  'RECORD_TAG',
  'ZERO_POSTINGS',
  'TOO_MANY_POSTINGS',
  'BATCH_ID_FORMAT',
  'FILLER_NOT_SPACE',
  'RECORD_ID_NOT_DIGITS',
  'ACCOUNT_NOT_DIGITS',
  'AMOUNT_NOT_DIGITS',
  'SALT_NOT_DIGITS',
  'COUNT_NOT_DIGITS',
  'RECORD_ID_RANGE',
  'ACCOUNT_RANGE',
  'AMOUNT_RANGE',
  'SALT_RANGE',
  'SIDE_INVALID',
  'FLAG_INVALID',
  'BATCH_ID_MISMATCH',
  'COUNT_MISMATCH',
] as const;

export type BatchFormatCode = (typeof BATCH_FORMAT_CODES)[number];

/**
 * A defect in a batch text (parser) or in a `Batch` (serializer). Holds only the 1-based line
 * and the reason code. The message is `BATCH FORMAT ERROR LINE <n> <CODE>` and never holds a
 * field value.
 */
export class BatchFormatError extends Error {
  readonly code: BatchFormatCode;
  readonly line: number;

  constructor(code: BatchFormatCode, line: number) {
    super(`BATCH FORMAT ERROR LINE ${line} ${code}`);
    this.name = 'BatchFormatError';
    this.code = code;
    this.line = line;
  }
}

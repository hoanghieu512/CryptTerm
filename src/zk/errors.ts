// Range errors for posting fields and the two public scalars. Messages carry a label and a slot
// index only, never the offending value, and no property of the error holds the value.

export type PostingFieldName =
  | 'recordId'
  | 'account'
  | 'side'
  | 'amountCents'
  | 'reviewFlag'
  | 'salt' // per slot
  | 'limitCents'
  | 'recordCount'; // not per slot

const LABELS: Readonly<Record<PostingFieldName, string>> = {
  recordId: 'RECORD ID',
  account: 'ACCOUNT',
  side: 'SIDE',
  amountCents: 'AMOUNT',
  reviewFlag: 'REVIEW FLAG',
  salt: 'SALT',
  limitCents: 'LIMIT',
  recordCount: 'RECORD COUNT',
};

/**
 * A field is outside its allowed range. Deliberately does not extend `RangeError`, so tests can
 * tell the two apart. `slot` is a plain slot index (a count, not money), or null for
 * `limitCents` and `recordCount`.
 */
export class FieldRangeError extends Error {
  readonly field: PostingFieldName;
  readonly slot: number | null;

  constructor(field: PostingFieldName, slot: number | null) {
    super(slot === null ? `${LABELS[field]} OUT OF RANGE` : `${LABELS[field]} OUT OF RANGE AT SLOT ${slot}`);
    this.name = 'FieldRangeError';
    this.field = field;
    this.slot = slot;
  }
}

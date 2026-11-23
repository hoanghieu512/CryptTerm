// Amount_Input parsing and cents formatting (terminal-ui design, section D).
//
// Amounts are bigint cents. Nothing here uses `Number`, `parseInt` or `parseFloat`. The text is
// checked for digits only, a leading zero and its length before `BigInt` sees it. The error
// messages are fixed and never contain the typed text.
import { AMOUNT_BOUND_CENTS } from '../../ledger/field';
import { POSTING_COLUMNS } from '../../ledger/layout';
import type { Cents } from '../../ledger/posting';

export type AmountInputError = 'EMPTY' | 'NOT_DIGITS' | 'LEADING_ZERO' | 'OUT_OF_RANGE';
export type AmountInputResult =
  | { readonly ok: true; readonly value: Cents }
  | { readonly ok: false; readonly error: AmountInputError };

export const AMOUNT_INPUT_MESSAGES: Readonly<Record<AmountInputError, string>> = Object.freeze({
  EMPTY: 'AMOUNT REQUIRED',
  NOT_DIGITS: 'AMOUNT MUST BE DIGITS ONLY, IN CENTS',
  LEADING_ZERO: 'AMOUNT MUST NOT START WITH ZERO',
  OUT_OF_RANGE: 'AMOUNT OUT OF RANGE',
});

const DIGITS_ONLY = /^[0-9]+$/;
const MAX_AMOUNT_CHARS: number = POSTING_COLUMNS.amount.width;

export function parseAmountInput(text: string): AmountInputResult {
  if (typeof text !== 'string' || text.length === 0) return { ok: false, error: 'EMPTY' };
  if (!DIGITS_ONLY.test(text)) return { ok: false, error: 'NOT_DIGITS' };
  if (text.length > 1 && text.startsWith('0')) return { ok: false, error: 'LEADING_ZERO' };
  // Length check first, so a very long digit string never reaches BigInt.
  if (text.length > MAX_AMOUNT_CHARS) return { ok: false, error: 'OUT_OF_RANGE' };
  const value = BigInt(text);
  if (value >= AMOUNT_BOUND_CENTS) return { ok: false, error: 'OUT_OF_RANGE' };
  return { ok: true, value };
}

/** `<whole>.<two digits>` from integer arithmetic and strings only. `INVALID` for any other value. */
export function formatCents(cents: Cents): string {
  if (typeof cents !== 'bigint' || cents < 0n) return 'INVALID';
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole.toString()}.${fraction}`;
}

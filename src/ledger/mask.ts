// Account masking for display (terminal-ui design, section E).
//
// `maskAccount` is the only way an account becomes text in the UI. It shows the last four digits
// of the 20-digit zero-padded decimal form and masks the rest. It fails closed: any value that is
// not a bigint in 0 .. ID_MAX gives a fully masked string. It never throws and never logs.
import { ID_MAX } from './field';
import { POSTING_COLUMNS, padDigits } from './layout';

export const MASK_CHAR = 'X';
/** Width of the masked text: the width of the account column. */
export const MASK_WIDTH: number = POSTING_COLUMNS.account.width;
/** Number of trailing digits that stay visible. */
export const VISIBLE_DIGITS = 4;

export function maskAccount(account: bigint): string {
  if (typeof account !== 'bigint' || account < 0n || account > ID_MAX) {
    return MASK_CHAR.repeat(MASK_WIDTH);
  }
  const digits = padDigits(account, MASK_WIDTH);
  return MASK_CHAR.repeat(MASK_WIDTH - VISIBLE_DIGITS) + digits.slice(-VISIBLE_DIGITS);
}

// Assertion helpers shared by the ledger-format tests (parser and serializer error checks).
//
// A `BatchFormatError` must hold only a 1-based line number and a reason code
// (ledger-format Requirement 1.4, design.md "Parse order"). These helpers check the class, the
// line, the code, the exact message, and that no planted value appears in any text the error
// exposes. Nothing here prints anything.
import { expect } from 'vitest';
import { BatchFormatError } from '../../src/ledger/batch';

/** Shortest planted string that is checked. Shorter strings can occur in the message by chance. */
const MIN_SECRET_LENGTH = 8;

/** Runs `fn` and returns what it threw, or `undefined` when it did not throw. */
export function captureThrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error ?? new Error('NOTHING THROWN VALUE');
  }
  return undefined;
}

/** The message and every own property value of an error, as text: all a caller could read. */
export function errorTexts(error: Error): string[] {
  const texts: string[] = [error.message, error.stack ?? ''];
  for (const key of Object.getOwnPropertyNames(error)) {
    texts.push(String(Reflect.get(error, key)));
  }
  return texts;
}

/** The decimal and hexadecimal spellings of a value, without a sign. */
export function valueForms(value: bigint): string[] {
  const abs = value < 0n ? -value : value;
  return [abs.toString(), abs.toString(16)];
}

/**
 * Asserts that `thrown` is a `BatchFormatError` with the expected line and code, the exact
 * message `BATCH FORMAT ERROR LINE <n> <CODE>`, and none of `secrets` in any exposed text.
 */
export function expectFormatError(
  thrown: unknown,
  expected: { readonly line: number; readonly code: string; readonly secrets: readonly string[] },
): void {
  expect(thrown).toBeInstanceOf(BatchFormatError);
  if (!(thrown instanceof BatchFormatError)) throw new Error('UNREACHABLE');
  expect(thrown.line).toBe(expected.line);
  expect(thrown.code).toBe(expected.code);
  expect(thrown.message).toBe(`BATCH FORMAT ERROR LINE ${expected.line} ${expected.code}`);
  const texts = errorTexts(thrown);
  for (const secret of expected.secrets) {
    if (secret.length < MIN_SECRET_LENGTH) continue;
    for (const text of texts) {
      expect(text.includes(secret)).toBe(false);
    }
  }
}

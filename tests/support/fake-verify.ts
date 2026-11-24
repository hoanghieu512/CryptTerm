// Fake verifier for the CTM900 tests (verifier design, "Testing Strategy").
//
// It records the arguments of every call and holds each call open until a test calls `resolve` or
// `reject` for it. It does not enforce one run at a time: "no second call" is something the
// terminal model must guarantee, and a test asserts it on `calls`. Synthetic data only.
import type { Cents } from '../../src/ledger/posting';

export interface FakeVerifyCall {
  readonly text: string;
  readonly limitCents: Cents;
}

export interface FakeVerify {
  /** Has the shape of `TerminalDeps['verify']`. */
  readonly verify: (text: string, policy: { readonly limitCents: Cents }) => Promise<unknown>;
  /** Every call, in order. */
  readonly calls: FakeVerifyCall[];
  /** Resolves the call at `index` (default: the latest) with any value. */
  resolve(value: unknown, index?: number): void;
  /** Rejects the call at `index` (default: the latest) with any value. */
  reject(value: unknown, index?: number): void;
  /** The next call throws `value` synchronously. */
  throwOnNextCall(value: unknown): void;
}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (value: unknown) => void;
}

export function createFakeVerify(): FakeVerify {
  const calls: FakeVerifyCall[] = [];
  const pending: Pending[] = [];
  let toThrow: { readonly value: unknown } | null = null;

  const pendingAt = (index: number | undefined): Pending => {
    const item = pending[index ?? pending.length - 1];
    if (item === undefined) throw new Error('FIXTURE: NO SUCH VERIFY CALL');
    return item;
  };

  return {
    calls,
    verify(text, policy) {
      calls.push({ text, limitCents: policy.limitCents });
      if (toThrow !== null) {
        const { value } = toThrow;
        toThrow = null;
        // Keep `pending` aligned with `calls`: a call that threw has nothing to settle.
        pending.push({ resolve: () => undefined, reject: () => undefined });
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- the fake throws any value on purpose
        throw value;
      }
      return new Promise<unknown>((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    },
    resolve(value, index) {
      pendingAt(index).resolve(value);
    },
    reject(value, index) {
      pendingAt(index).reject(value);
    },
    throwOnNextCall(value) {
      toThrow = { value };
    },
  };
}

/** Lets every queued promise reaction run, so a settled fake reaches the model. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

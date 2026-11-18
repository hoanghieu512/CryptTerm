import fc from 'fast-check';
import { expect, test } from 'vitest';

// Placeholder: proves that Vitest and fast-check are wired together and that bigint cents work.
// Replace with the real ledger properties in the ledger-format spec.
test('bigint cents addition is commutative', () => {
  fc.assert(
    fc.property(fc.bigInt({ min: 0n, max: 2n ** 40n - 1n }), fc.bigInt({ min: 0n, max: 2n ** 40n - 1n }), (a, b) => {
      expect(a + b).toBe(b + a);
    }),
  );
});

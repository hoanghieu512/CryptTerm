// Why a second config file: a bare `vitest run` auto-discovers only `vitest.config.*` and
// `vite.config.*`, so the slow proof tests under `tests/zk/proof/` stay out of `npm test`
// and run only through `npm run test:proof` (`vitest run --config vitest.proof.config.ts`).
import { configDefaults, defineConfig } from 'vitest/config';

// Measured by task 7.7 (Node 24.14.1, single thread, committed 32768-point SRS). The larger of
// two verbose runs was used: T_prove 2939.3 ms, T_verify 21.1 ms (the other run: 2815.9 ms, 18.8 ms).
//   Property 4: 3 x 3 x (T_prove + T_verify)     = 26643.6 ms -> 30 s
//   Property 5: 3 x 3 x (T_prove + 4 x T_verify) = 27213.3 ms -> 30 s
// Each rounded up to the next 10 s, then the max. Recompute if the circuit or toolchain changes.
export const PROOF_TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/zk/proof/**/*.test.ts'],
    exclude: [...configDefaults.exclude],
    testTimeout: PROOF_TEST_TIMEOUT_MS,
    hookTimeout: PROOF_TEST_TIMEOUT_MS,
    // Proving is memory heavy, so run one test file at a time.
    fileParallelism: false,
  },
});

// Property-test runner helper (Requirements 6.1, 6.7).
//
// Every property in the zk-spike carries a fixed seed written in its source. This helper prints
// that seed and `numRuns` to stdout at the START of every property run, and then calls
// `fc.assert` with the same values, so a failing CI log always shows what to replay.
//
// Failure output. `fc.assert` (fast-check 4.10.3) throws an error whose message is
//   Property failed after <n> tests
//   { seed: <seed>, path: "<path>", endOnFailure: true }
//   Counterexample: <shrunk counterexample>
//   Shrunk <k> time(s)
// (`preFormatFailure` in `node_modules/fast-check/lib/fast-check.js`), and the original error
// from the predicate is attached as `cause`. So the seed and the shrunk counterexample reach the
// test output with no extra reporter. This helper does not replace the reporter.
//
// Tag comment. Each property file carries, above its test, the comment
//   Feature: zk-spike, Property <n>: <text>
// This helper does not need it and does not read it.
//
// Security (`.kiro/steering/security.md`, rule 1): the printed line holds a label, a seed and a
// run count. These are not batch data. NEVER pass witness, posting, account, amount or salt
// values into `name`, and never print them from a property. The generators in
// `tests/support/` produce synthetic values only, so a shrunk counterexample in a failure message
// is synthetic data.
import fc from 'fast-check';

/** Planned seeds, one per property (design.md "Testing Strategy"). Written in source on purpose. */
export const PROPERTY_SEEDS = {
  P1: 20261101,
  P2: 20261102,
  P3: 20261103,
  P4: 20261104,
  P5: 20261105,
} as const;

export interface PropertyConfig {
  /** Fixed integer seed, written in the property file's source. */
  readonly seed: number;
  /** Number of generated cases. */
  readonly numRuns: number;
}

/** The `fc.assert` parameters for a config. Validates both values. */
export function fcParams(config: PropertyConfig): fc.Parameters<unknown> {
  const { seed, numRuns } = config;
  if (!Number.isSafeInteger(seed)) {
    throw new Error('PBT CONFIG INVALID: seed must be a safe integer');
  }
  if (!Number.isSafeInteger(numRuns) || numRuns < 1) {
    throw new Error('PBT CONFIG INVALID: numRuns must be a positive integer');
  }
  return { seed, numRuns };
}

/** The line printed at the start of a run. `name` is a static label, never data. */
export function seedLine(name: string, config: PropertyConfig): string {
  return `PBT ${name} seed=${config.seed} numRuns=${config.numRuns}\n`;
}

/**
 * Prints the seed line, then runs `fc.assert` with the fixed seed and `numRuns`.
 * Async properties return a promise: the caller must `await` it.
 */
export function runProperty<T>(
  name: string,
  config: PropertyConfig,
  property: fc.IAsyncProperty<T>,
): Promise<void>;
export function runProperty<T>(name: string, config: PropertyConfig, property: fc.IProperty<T>): void;
export function runProperty<T>(
  name: string,
  config: PropertyConfig,
  property: fc.IAsyncProperty<T> | fc.IProperty<T>,
): Promise<void> | void {
  const params = fcParams(config);
  process.stdout.write(seedLine(name, config));
  return fc.assert(property as fc.IRawProperty<T>, params as fc.Parameters<T>);
}

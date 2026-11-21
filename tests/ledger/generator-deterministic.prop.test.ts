import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SALT_BOUND } from '../../src/ledger/field';
import { generateBatch } from '../../src/ledger/generate';
import { runProperty } from '../support/pbt';
import { batchIdArb } from '../support/ledger-arbitraries';

// Feature: ledger-format, Property generator_deterministic: For all equal opts, generateBatch returns deep-equal batches, every salt is below SALT_BOUND, and invalid options throw the fixed message
// **Validates: Requirements 4.2, 4.7, 4.8**
//
// Seed 20262007, 200 runs. Covers: equal opts give deep-equal batches (also when other batches
// are generated in between), salts in range, the three fixed error messages, and a source scan
// of `src/ledger/generate.ts` and `src/ledger/prng.ts` (no `Math.random`, clock or platform
// randomness outside comments; the statement that seeded salts are not random).
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262007;
const NUM_RUNS = 200;

type GenerateOptions = Parameters<typeof generateBatch>[0];
type Kind = GenerateOptions['kind'];

const KINDS: readonly Kind[] = ['clean', 'overLimitUnflagged', 'unbalanced', 'large'];

const MSG_SEED = 'GENERATOR SEED INVALID';
const MSG_COUNT = 'GENERATOR COUNT INVALID';
const MSG_LARGE = 'GENERATOR LARGE REQUIRES 64';

/** Seeds: small values, 32-bit edges and the safe-integer top (the seed rule folds the high bits). */
const seedArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 1_000_000 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1, 2 ** 32 - 1, 2 ** 32, 2 ** 32 + 1, Number.MAX_SAFE_INTEGER) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }) },
);

/** Valid generator options. `large` always has count 64. */
const optsArb: fc.Arbitrary<GenerateOptions> = fc
  .tuple(
    fc.constantFrom(...KINDS),
    seedArb,
    fc.oneof(
      { weight: 1, arbitrary: fc.constantFrom(2, 3, 4, 5, 63, 64) },
      { weight: 4, arbitrary: fc.integer({ min: 2, max: 64 }) },
    ),
    batchIdArb,
  )
  .map(([kind, seed, count, batchId]): GenerateOptions => ({
    kind,
    seed,
    count: kind === 'large' ? 64 : count,
    batchId,
  }));

/** The message of the error thrown by `fn`, or null if nothing was thrown. */
function thrownMessage(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : 'NOT AN ERROR';
  }
  return null;
}

/** Source text without `/* ... *\/` blocks and `// ...` line comments. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function readSource(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../src/ledger/${name}`, import.meta.url)), 'utf8');
}

const BASE: GenerateOptions = { kind: 'clean', seed: 1001, count: 12, batchId: 'CTB-20261201-001' };

describe('generator_deterministic', () => {
  it('generator_deterministic: equal opts give deep-equal batches with every salt below SALT_BOUND', () => {
    runProperty(
      'ledger-format generator_deterministic',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(optsArb, seedArb, (opts, otherSeed) => {
        const first = generateBatch(opts);
        // A fresh copy of the opts, and a different batch generated in between: no hidden state.
        generateBatch({ ...opts, seed: otherSeed });
        const second = generateBatch({ ...opts });

        expect(second).toStrictEqual(first);
        expect(first.batchId).toBe(opts.batchId);
        expect(first.postings.length).toBe(opts.count);
        for (const posting of first.postings) {
          expect(posting.salt >= 0n).toBe(true);
          expect(posting.salt < SALT_BOUND).toBe(true);
        }
      }),
    );
  });

  it('generator_deterministic: a seed above 2^32 is not folded onto its low 32 bits', () => {
    // Seed rule: s0 = ((seed >>> 0) ^ imul(floor(seed / 2^32), 0x9E3779B1)) | 0. Seeds 5 and
    // 2^32 + 5 share the low word, so only the high-word term separates them.
    const low = generateBatch({ ...BASE, seed: 5 });
    const high = generateBatch({ ...BASE, seed: 2 ** 32 + 5 });
    expect(high).not.toStrictEqual(low);
  });

  it('generator_deterministic: seeds that are not non-negative safe integers throw GENERATOR SEED INVALID', () => {
    const badSeeds = [-1, -1_000_000, 1.5, 0.1, Number.MAX_SAFE_INTEGER + 1, 2 ** 60, Number.NaN, Infinity, -Infinity];
    for (const kind of KINDS) {
      for (const seed of badSeeds) {
        const count = kind === 'large' ? 64 : 12;
        expect(thrownMessage(() => generateBatch({ ...BASE, kind, seed, count }))).toBe(MSG_SEED);
      }
    }
  });

  it('generator_deterministic: counts outside 2 to 64 or not integers throw GENERATOR COUNT INVALID', () => {
    const badCounts = [-1, 0, 1, 65, 66, 1000, 2.5, 12.000001, Number.NaN, Infinity, -Infinity];
    for (const kind of ['clean', 'overLimitUnflagged', 'unbalanced'] as const) {
      for (const count of badCounts) {
        expect(thrownMessage(() => generateBatch({ ...BASE, kind, count }))).toBe(MSG_COUNT);
      }
    }
    // Count 2 and 64 are the accepted ends.
    expect(thrownMessage(() => generateBatch({ ...BASE, count: 2 }))).toBeNull();
    expect(thrownMessage(() => generateBatch({ ...BASE, count: 64 }))).toBeNull();
    // `large` with a non-integer count is a count error, not the large-only message.
    expect(thrownMessage(() => generateBatch({ ...BASE, kind: 'large', count: 2.5 }))).toBe(MSG_COUNT);
  });

  it('generator_deterministic: kind large with a count other than 64 throws GENERATOR LARGE REQUIRES 64', () => {
    for (let count = 2; count <= 63; count += 1) {
      expect(thrownMessage(() => generateBatch({ ...BASE, kind: 'large', count }))).toBe(MSG_LARGE);
    }
    expect(thrownMessage(() => generateBatch({ ...BASE, kind: 'large', count: 64 }))).toBeNull();
    // The fixed messages hold no option value.
    const message = thrownMessage(() => generateBatch({ ...BASE, kind: 'large', count: 17, seed: 987654321 }));
    expect(message).toBe(MSG_LARGE);
  });

  it('generator_deterministic: the generator sources use no Math.random, clock or platform randomness', () => {
    for (const name of ['generate.ts', 'prng.ts']) {
      const code = stripComments(readSource(name));
      expect(code, `${name} must not use Math.random`).not.toMatch(/\bMath\s*\.\s*random\b/);
      expect(code, `${name} must not use Date`).not.toMatch(/\bDate\s*\./);
      expect(code, `${name} must not use performance`).not.toMatch(/\bperformance\b/);
      expect(code, `${name} must not use crypto`).not.toMatch(/\bcrypto\s*\./);
    }
  });

  it('generator_deterministic: the generate.ts source states that seeded salts are for demo determinism and not random', () => {
    const source = readSource('generate.ts');
    expect(source).toMatch(/seeded salts/i);
    expect(source).toMatch(/not random/i);
  });
});

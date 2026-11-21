// Seeded PRNG for the batch generator (ledger-format design.md "Generator", "PRNG").
//
// mulberry32: 32-bit state, public domain, NOT cryptographic. Output is a pure function of the
// seed. There is no clock, no platform randomness and no hidden state outside the closure.
// Words are 32-bit counters. They are turned into `bigint` at once and no word is money.

/** A seeded generator. `nextWord` returns one 32-bit word, `nextBelow` a uniform bigint. */
export interface Prng {
  /** One mulberry32 word, 0 .. 2^32 - 1, as a bigint. */
  nextWord(): bigint;
  /** Uniform value in `0 <= v < bound` by rejection sampling. `bound = 1n` draws nothing. */
  nextBelow(bound: bigint): bigint;
}

const STATE_STEP = 0x6d2b79f5;
const SEED_HIGH_MULTIPLIER = 0x9e3779b1;
const TWO_POW_32 = 4294967296;
const WORD_BITS = 32n;

/** Seed rule: `s0 = ((seed >>> 0) ^ imul(floor(seed / 2^32), 0x9E3779B1)) | 0`. */
function initialState(seed: number): number {
  const high = Math.floor(seed / TWO_POW_32);
  return ((seed >>> 0) ^ Math.imul(high, SEED_HIGH_MULTIPLIER)) | 0;
}

/** Bit length of a positive bigint. */
function bitLength(value: bigint): number {
  return value.toString(2).length;
}

/**
 * Creates a generator from a non-negative safe-integer seed. The caller validates the seed
 * (`generateBatch` throws `GENERATOR SEED INVALID`).
 */
export function createPrng(seed: number): Prng {
  let s = initialState(seed);

  const nextWord = (): bigint => {
    s = (s + STATE_STEP) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return BigInt((t ^ (t >>> 14)) >>> 0);
  };

  const nextBelow = (bound: bigint): bigint => {
    if (bound <= 0n) {
      throw new Error('PRNG BOUND INVALID');
    }
    if (bound === 1n) {
      return 0n;
    }
    const bits = bitLength(bound - 1n);
    const wordCount = Math.ceil(bits / 32);
    const mask = (1n << BigInt(bits)) - 1n;
    for (;;) {
      let value = 0n;
      for (let i = 0; i < wordCount; i += 1) {
        value = (value << WORD_BITS) | nextWord();
      }
      value &= mask;
      if (value < bound) {
        return value;
      }
    }
  };

  return { nextWord, nextBelow };
}

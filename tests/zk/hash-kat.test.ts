import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bytes32ToField, fieldToBytes32, FIELD_MODULUS } from '../../src/ledger/field';
import type { Hasher } from '../../src/zk/hash';
import { merkleLevels, merkleRoot } from '../../src/zk/merkle';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Feature: zk-spike, Property 6: Recorded hash vectors are reproduced
//
// Requirements 3.2, 3.3, 3.11. Table-driven example test: the table is the quantifier, so there is
// no seed and no `numRuns`.
//
// Three checks:
//   1. the bb.js hasher returns the six recorded vectors and the five all-padding levels. The
//      expected values are written below as hex literals AND the test reads `.kiro/steering/noir.md`
//      and asserts every value appears there, so a change in either place fails the test;
//   2. the hasher output equals a reference sponge built only from `poseidon2Permutation`, for the
//      two call shapes (length 2 and length 6). The reference lives in this file only;
//   3. negative controls: mutated expectations and a mutated noir.md text are rejected by the same
//      comparison functions, so checks 1 and 2 cannot pass vacuously.
//
// If a vector differs (U3), stop and report per Requirement 3.3. The test never prints a value.

const NOIR_MD_PATH = fileURLToPath(new URL('../../.kiro/steering/noir.md', import.meta.url));
const WASM_TIMEOUT_MS = 120_000;
const HEX_64 = /^0x[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// The recorded values. Copied from `.kiro/steering/noir.md` "Known-answer vectors" and
// "Merkle layout" (and `circuits/ledger_audit/src/tests.nr`).
// ---------------------------------------------------------------------------

const VECTOR_NAMES = ['PAD_LEAF', 'LEAF_A', 'LEAF_B', 'NODE_A', 'NODE_SMALL', 'EMPTY_ROOT'] as const;
type VectorName = (typeof VECTOR_NAMES)[number];
type VectorTable = Readonly<Record<VectorName, bigint>>;

const EXPECTED: VectorTable = {
  PAD_LEAF: 0x0286f724918d0f8663988824651273d4703d44b1cef1a9a31e4d1f6e0d35e8f8n,
  LEAF_A: 0x259c4874e82dc29fd6b1cf8be4d604bceaebdd7c7c2a9a4052444cfc9d25a1adn,
  LEAF_B: 0x00a9e776d5c445c897eb24ef60bd057ef514d00fcb40bcf89a6d7cde29f5b1e8n,
  NODE_A: 0x2f83e3c909349719e9cb57a5d79a7a0989f971c02246fe6fc9d47e882b600af4n,
  NODE_SMALL: 0x1f7a903ff6ebf6088f018bef42d630d28cc499eec89bec2ba6cc2763da3b957cn,
  EMPTY_ROOT: 0x22d28221a316eb2b0ae742ae204890369a507e2d66bd93314f8f56c697af75c8n,
};

/** All-padding levels 1 to 5 (`node(x, x)` from the level below). Level 0 is `PAD_LEAF`, level 6 `EMPTY_ROOT`. */
const EXPECTED_PADDING_LEVELS_1_TO_5: readonly bigint[] = [
  0x1b3d40de538ba8f1f0c867584f556a4e9fff88f9581752f57e1cf361e50096cen,
  0x1e6fb0e72009de192abf34a6ba4452d2d8ce769cc1cb65de11981dc03de0691fn,
  0x2ed442569f7fb84df1cc04358a8b1b250f00273f6c72e08aba24ee6e6e8d3ab3n,
  0x1e3f41304522a00121bac973d7762885b97c8b7387a4ece55cece1da229d2e00n,
  0x1bf3a1577da89a0905233c0977ae02c54d2f72decab4ecdd12f829db4ae903e9n,
];

/** Vector inputs, exactly as in noir.md and design Q1. `PAD_LEAF = leaf([0, 0, 0, 0, 0, 0])`. */
const PAD_LEAF_INPUT = [0n, 0n, 0n, 0n, 0n, 0n] as const;
const LEAF_A_INPUT = [1n, 1000000000000001n, 0n, 250000n, 1n, 987654321n] as const;
const LEAF_B_INPUT = [2n, 1000000000000002n, 1n, 250000n, 0n, 123456789n] as const;
const NODE_SMALL_INPUT = [7n, 8n] as const;

// ---------------------------------------------------------------------------
// Pure comparison helpers (also used by the negative controls)
// ---------------------------------------------------------------------------

/** `0x` plus 64 lowercase hex digits. */
function toHex64(value: bigint): string {
  return `0x${value.toString(16).padStart(64, '0')}`;
}

/** Names whose actual value differs from the expected value. Empty means all match. */
function mismatchedVectors(expected: VectorTable, actual: VectorTable): VectorName[] {
  return VECTOR_NAMES.filter((name) => expected[name] !== actual[name]);
}

/** Values whose `0x` + 64-hex form is not found in `text`. Empty means all are recorded. */
function valuesMissingFromText(text: string, values: readonly bigint[]): bigint[] {
  return values.filter((value) => !text.includes(toHex64(value)));
}

/** The value with one hex digit (counted from the left, 0 to 63) replaced by the next digit. */
function withOneHexDigitChanged(value: bigint, position: number): bigint {
  const hex = toHex64(value).slice(2);
  const digit = parseInt(hex.charAt(position), 16);
  const changed = `${hex.slice(0, position)}${((digit + 1) % 16).toString(16)}${hex.slice(position + 1)}`;
  return BigInt(`0x${changed}`);
}

function withVector(table: VectorTable, name: VectorName, value: bigint): VectorTable {
  return { ...table, [name]: value };
}

function withSwapped(table: VectorTable, a: VectorName, b: VectorName): VectorTable {
  return { ...table, [a]: table[b], [b]: table[a] };
}

// ---------------------------------------------------------------------------
// Reference sponge, built only from `poseidon2Permutation` (test file only)
// ---------------------------------------------------------------------------

const RATE = 3;
const STATE_WIDTH = 4;
const LENGTH_SHIFT = 2n ** 64n;

/** The part of `Barretenberg` the reference sponge uses. Request `Poseidon2Permutation` is `{ inputs: Uint8Array[] }`. */
interface PermutationApi {
  poseidon2Permutation(request: { inputs: Uint8Array[] }): Promise<{ outputs: Uint8Array[] }>;
}

async function permute(api: PermutationApi, state: readonly bigint[]): Promise<bigint[]> {
  const { outputs } = await api.poseidon2Permutation({ inputs: state.map((v) => fieldToBytes32(v)) });
  if (outputs.length !== STATE_WIDTH) {
    throw new Error('PERMUTATION OUTPUT LENGTH');
  }
  return outputs.map((o) => bytes32ToField(o));
}

/**
 * Sponge of the settled Hash_Variant: state `[0, 0, 0, len * 2^64]`, inputs added into
 * `state[0..2]` three at a time (a short last block leaves the missing slots unchanged, which is
 * adding 0), one permutation after each block, output `state[0]`.
 */
async function referenceSponge(api: PermutationApi, inputs: readonly bigint[]): Promise<bigint> {
  let state: bigint[] = [0n, 0n, 0n, BigInt(inputs.length) * LENGTH_SHIFT];
  for (let start = 0; start < inputs.length; start += RATE) {
    const next = [...state];
    for (let k = 0; k < RATE; k += 1) {
      const input = inputs[start + k] ?? 0n;
      next[k] = ((next[k] ?? 0n) + input) % FIELD_MODULUS;
    }
    state = await permute(api, next);
  }
  const out = state[0];
  if (out === undefined) {
    throw new Error('PERMUTATION OUTPUT EMPTY');
  }
  return out;
}

type LeafInput = readonly [bigint, bigint, bigint, bigint, bigint, bigint];

const MAX_ELEMENT = FIELD_MODULUS - 1n;

/** Six vector inputs plus extra fixed inputs, all synthetic. */
const LEAF_SHAPE_INPUTS: readonly LeafInput[] = [
  PAD_LEAF_INPUT,
  LEAF_A_INPUT,
  LEAF_B_INPUT,
  [1n, 2n, 3n, 4n, 5n, 6n],
  [MAX_ELEMENT, MAX_ELEMENT, MAX_ELEMENT, MAX_ELEMENT, MAX_ELEMENT, MAX_ELEMENT],
  [0n, 0n, 0n, 1n, 0n, 0n],
  [2n ** 64n - 1n, 2n ** 64n, 2n ** 248n - 1n, 2n ** 40n - 1n, 1n, 2n ** 128n],
];

type NodeInput = readonly [bigint, bigint];

/** `NODE_A` and `EMPTY_ROOT` inputs come from computed values and are added at run time. */
const NODE_SHAPE_FIXED_INPUTS: readonly NodeInput[] = [
  NODE_SMALL_INPUT,
  [0n, 0n],
  [0n, 1n],
  [1n, 0n],
  [MAX_ELEMENT, MAX_ELEMENT],
  [MAX_ELEMENT, 1n],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hash known-answer vectors', () => {
  let env: HasherEnv;
  let hasher: Hasher;
  let actual: VectorTable;
  let paddingLevels: bigint[][];
  let noirMd: string;

  beforeAll(async () => {
    env = await createHasherEnv();
    hasher = env.hasher;
    noirMd = readFileSync(NOIR_MD_PATH, 'utf8');

    const padLeaf = await hasher.hashLeaf(PAD_LEAF_INPUT);
    const leafA = await hasher.hashLeaf(LEAF_A_INPUT);
    const leafB = await hasher.hashLeaf(LEAF_B_INPUT);
    const nodeA = await hasher.hashNode(leafA, leafB);
    const nodeSmall = await hasher.hashNode(NODE_SMALL_INPUT[0], NODE_SMALL_INPUT[1]);
    const padLeaves: bigint[] = Array.from({ length: 64 }, () => padLeaf);
    const emptyRoot = await merkleRoot(hasher, padLeaves);
    paddingLevels = await merkleLevels(hasher, padLeaves);
    actual = {
      PAD_LEAF: padLeaf,
      LEAF_A: leafA,
      LEAF_B: leafB,
      NODE_A: nodeA,
      NODE_SMALL: nodeSmall,
      EMPTY_ROOT: emptyRoot,
    };
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await env.destroy();
  });

  describe('recorded vectors', () => {
    it('the table is well formed: six names, canonical field elements', () => {
      expect(VECTOR_NAMES).toHaveLength(6);
      for (const name of VECTOR_NAMES) {
        const value = EXPECTED[name];
        expect(value >= 0n && value < FIELD_MODULUS).toBe(true);
        expect(toHex64(value)).toMatch(HEX_64);
      }
      expect(new Set(VECTOR_NAMES.map((n) => EXPECTED[n])).size).toBe(6);
    });

    it.each(VECTOR_NAMES)('the bb.js hasher returns the recorded value for %s', (name) => {
      expect(actual[name]).toBe(EXPECTED[name]);
    });

    it('no vector differs in a single comparison over the whole table', () => {
      expect(mismatchedVectors(EXPECTED, actual)).toEqual([]);
    });

    it('the five all-padding levels 1 to 5 match the recorded values, level 0 is PAD_LEAF and level 6 is EMPTY_ROOT', () => {
      expect(paddingLevels).toHaveLength(7);
      expect(paddingLevels.map((level) => level.length)).toEqual([64, 32, 16, 8, 4, 2, 1]);
      for (const level of paddingLevels) {
        expect(new Set(level).size).toBe(1);
      }
      const firstOfEachLevel = paddingLevels.map((level) => level[0]);
      expect(firstOfEachLevel[0]).toBe(EXPECTED.PAD_LEAF);
      expect(firstOfEachLevel.slice(1, 6)).toEqual(EXPECTED_PADDING_LEVELS_1_TO_5);
      expect(firstOfEachLevel[6]).toBe(EXPECTED.EMPTY_ROOT);
    });

    it('every expected value appears in .kiro/steering/noir.md as 0x plus 64 lowercase hex digits', () => {
      const recorded = [...VECTOR_NAMES.map((n) => EXPECTED[n]), ...EXPECTED_PADDING_LEVELS_1_TO_5];
      expect(valuesMissingFromText(noirMd, recorded)).toEqual([]);
    });
  });

  describe('reference sponge from poseidon2Permutation only', () => {
    it.each(LEAF_SHAPE_INPUTS.map((inputs, index) => ({ index, inputs })))(
      'length 6 (two blocks), input set $index: hasher equals reference sponge',
      async ({ inputs }) => {
        const viaHasher = await hasher.hashLeaf(inputs);
        const viaReference = await referenceSponge(env.api, inputs);
        expect(viaHasher).toBe(viaReference);
      },
    );

    it.each(NODE_SHAPE_FIXED_INPUTS.map((inputs, index) => ({ index, inputs })))(
      'length 2 (one block, third slot 0), input set $index: hasher equals reference sponge',
      async ({ inputs }) => {
        const viaHasher = await hasher.hashNode(inputs[0], inputs[1]);
        const viaReference = await referenceSponge(env.api, inputs);
        expect(viaHasher).toBe(viaReference);
      },
    );

    it('the reference sponge reproduces all six recorded vectors', async () => {
      const referenceTable: VectorTable = {
        PAD_LEAF: await referenceSponge(env.api, PAD_LEAF_INPUT),
        LEAF_A: await referenceSponge(env.api, LEAF_A_INPUT),
        LEAF_B: await referenceSponge(env.api, LEAF_B_INPUT),
        NODE_A: await referenceSponge(env.api, [EXPECTED.LEAF_A, EXPECTED.LEAF_B]),
        NODE_SMALL: await referenceSponge(env.api, NODE_SMALL_INPUT),
        EMPTY_ROOT: await referenceSponge(env.api, [
          EXPECTED_PADDING_LEVELS_1_TO_5[4] ?? 0n,
          EXPECTED_PADDING_LEVELS_1_TO_5[4] ?? 0n,
        ]),
      };
      expect(mismatchedVectors(EXPECTED, referenceTable)).toEqual([]);
    });

    it('the reference sponge sees node(x, x) for the padding levels', async () => {
      let level = EXPECTED.PAD_LEAF;
      for (const expectedNext of [...EXPECTED_PADDING_LEVELS_1_TO_5, EXPECTED.EMPTY_ROOT]) {
        level = await referenceSponge(env.api, [level, level]);
        expect(level).toBe(expectedNext);
      }
    });
  });

  describe('negative controls', () => {
    const mutations = VECTOR_NAMES.flatMap((name) => [0, 31, 63].map((position) => ({ name, position })));

    it.each(mutations)(
      'one hex digit changed in expected $name at digit $position is rejected',
      ({ name, position }) => {
        const mutated = withVector(EXPECTED, name, withOneHexDigitChanged(EXPECTED[name], position));
        expect(mutated[name]).not.toBe(EXPECTED[name]);
        expect(mismatchedVectors(mutated, actual)).toEqual([name]);
      },
    );

    const swaps: readonly (readonly [VectorName, VectorName])[] = [
      ['LEAF_A', 'LEAF_B'],
      ['NODE_A', 'NODE_SMALL'],
      ['PAD_LEAF', 'EMPTY_ROOT'],
    ];

    it.each(swaps)('expected %s and %s swapped is rejected', (a, b) => {
      const swapped = withSwapped(EXPECTED, a, b);
      expect(mismatchedVectors(swapped, actual).sort()).toEqual([a, b].sort());
    });

    it.each(VECTOR_NAMES)('a mutated noir.md text without the value of %s is rejected', (name) => {
      const hex = toHex64(EXPECTED[name]);
      const mutatedText = noirMd.split(hex).join('0x'.padEnd(66, '0'));
      expect(mutatedText).not.toBe(noirMd);
      const missing = valuesMissingFromText(mutatedText, [EXPECTED[name]]);
      expect(missing).toEqual([EXPECTED[name]]);
    });

    it('a noir.md text with one hex digit of a padding level changed is rejected', () => {
      const level = EXPECTED_PADDING_LEVELS_1_TO_5[0] ?? 0n;
      const mutatedText = noirMd.split(toHex64(level)).join(toHex64(withOneHexDigitChanged(level, 63)));
      expect(valuesMissingFromText(mutatedText, EXPECTED_PADDING_LEVELS_1_TO_5)).toEqual([level]);
    });

    it('a reference sponge with a wrong length tag differs from the hasher', async () => {
      // Capacity element 5 * 2^64 instead of 6 * 2^64: proves the reference check is sensitive.
      let state: bigint[] = [0n, 0n, 0n, 5n * LENGTH_SHIFT];
      for (let start = 0; start < LEAF_A_INPUT.length; start += RATE) {
        const next = [...state];
        for (let k = 0; k < RATE; k += 1) {
          next[k] = ((next[k] ?? 0n) + (LEAF_A_INPUT[start + k] ?? 0n)) % FIELD_MODULUS;
        }
        state = await permute(env.api, next);
      }
      expect(state[0]).not.toBe(EXPECTED.LEAF_A);
    });
  });
});

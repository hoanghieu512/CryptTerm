import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CircuitInputs } from '../../src/zk/circuit-inputs';
import { FieldRangeError } from '../../src/zk/errors';
import type { PostingFieldName } from '../../src/zk/errors';
import { CAPACITY, FIELD_MODULUS, ID_MAX, SALT_BOUND } from '../../src/zk/field';
import type { Hasher, LeafFields } from '../../src/zk/hash';
import { merkleRoot } from '../../src/zk/merkle';
import { PADDING_POSTING, leafInputs } from '../../src/zk/posting';
import type { Posting } from '../../src/zk/posting';
import { assembleCircuitInputs, buildCircuitInputs } from '../../src/zk/witness-builder';
import type { BuiltInputs } from '../../src/zk/witness-builder';
import { createHasherEnv } from '../support/zk-env';
import type { HasherEnv } from '../support/zk-env';

// Requirements 3.7, 3.9, 3.10. Example test (no properties): the tables are the quantifiers.
// All values are synthetic. The test prints nothing and makes no network request.

const WASM_TIMEOUT_MS = 120_000;
const DECIMAL = /^(0|[1-9][0-9]*)$/;

const NOIR_MD_PATH = fileURLToPath(new URL('../../.kiro/steering/noir.md', import.meta.url));
const BUILDER_PATH = fileURLToPath(new URL('../../src/zk/witness-builder.ts', import.meta.url));
const CIRCUIT_INPUTS_PATH = fileURLToPath(new URL('../../src/zk/circuit-inputs.ts', import.meta.url));

// From `circuits/ledger_audit/src/tests.nr` and `.kiro/steering/noir.md` "Known-answer vectors".
const PAD_LEAF = 0x0286f724918d0f8663988824651273d4703d44b1cef1a9a31e4d1f6e0d35e8f8n;
const EMPTY_ROOT = 0x22d28221a316eb2b0ae742ae204890369a507e2d66bd93314f8f56c697af75c8n;

const LABELS: Readonly<Record<PostingFieldName, string>> = {
  recordId: 'RECORD ID',
  account: 'ACCOUNT',
  side: 'SIDE',
  amountCents: 'AMOUNT',
  reviewFlag: 'REVIEW FLAG',
  salt: 'SALT',
  limitCents: 'LIMIT',
  recordCount: 'RECORD COUNT',
};

const LIMIT_CENTS = 1_000_000n;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Three real postings: one debit of 100000, two credits of 60000 and 40000. Balanced, under limit. */
function realPostings(): Posting[] {
  return [
    { recordId: 100001n, account: 100000000001n, side: 0n, amountCents: 100000n, reviewFlag: 0n, salt: 900001n },
    { recordId: 100002n, account: 100000000002n, side: 1n, amountCents: 60000n, reviewFlag: 0n, salt: 900002n },
    { recordId: 100003n, account: 100000000003n, side: 1n, amountCents: 40000n, reviewFlag: 1n, salt: 900003n },
  ];
}

/** 64 slots: the three real postings, then padding. */
function slotsOf(real: readonly Posting[]): Posting[] {
  return [...real, ...Array.from({ length: CAPACITY - real.length }, () => PADDING_POSTING)];
}

/** Replaces one field of a posting with an arbitrary value (a deliberate type violation). */
function withField(p: Posting, field: keyof Posting, value: unknown): Posting {
  const patched: unknown = { ...p, [field]: value };
  return patched as Posting;
}

function at<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error('TEST FIXTURE INDEX OUT OF RANGE');
  return item;
}

// ---------------------------------------------------------------------------
// Spy and fake hashers
// ---------------------------------------------------------------------------

interface SpyHasher extends Hasher {
  readonly leafCalls: LeafFields[];
  readonly leafResults: bigint[];
  readonly nodeCalls: [bigint, bigint][];
  total(): number;
}

/** Wraps a hasher and records every call. */
function spyOn(inner: Hasher): SpyHasher {
  const leafCalls: LeafFields[] = [];
  const leafResults: bigint[] = [];
  const nodeCalls: [bigint, bigint][] = [];
  return {
    leafCalls,
    leafResults,
    nodeCalls,
    total: () => leafCalls.length + nodeCalls.length,
    async hashLeaf(fields) {
      leafCalls.push(fields);
      const out = await inner.hashLeaf(fields);
      leafResults.push(out);
      return out;
    },
    async hashNode(left, right) {
      nodeCalls.push([left, right]);
      return inner.hashNode(left, right);
    },
  };
}

/** Not Poseidon. A deterministic marker so a test can tell whether the builder used the hasher. */
const FAKE_HASHER: Hasher = {
  hashLeaf: (fields) => Promise.resolve(fields.reduce((sum, f) => sum + f, 0n) % FIELD_MODULUS),
  hashNode: (left, right) => Promise.resolve((left * 3n + right) % FIELD_MODULUS),
};

async function fakeRootOf(slots: readonly Posting[]): Promise<bigint> {
  const leaves: bigint[] = [];
  for (const p of slots) leaves.push(await FAKE_HASHER.hashLeaf(leafInputs(p)));
  return merkleRoot(FAKE_HASHER, leaves);
}

// ---------------------------------------------------------------------------
// Rejection helpers
// ---------------------------------------------------------------------------

interface Outcome {
  readonly result: BuiltInputs | undefined;
  readonly error: unknown;
}

async function attempt(run: () => Promise<BuiltInputs>): Promise<Outcome> {
  try {
    return { result: await run(), error: undefined };
  } catch (error) {
    return { result: undefined, error };
  }
}

/** Every own property value of an error (message and stack included), stringified. */
function ownPropertyTexts(error: Error): string[] {
  return Object.getOwnPropertyNames(error).map((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(error, name);
    return descriptor !== undefined && 'value' in descriptor ? String(descriptor.value) : '';
  });
}

function absDecimal(v: unknown): string | undefined {
  if (typeof v === 'bigint') return (v < 0n ? -v : v).toString(10);
  if (typeof v === 'number') return String(Math.abs(v));
  return undefined;
}

function expectRangeRejection(
  outcome: Outcome,
  spy: SpyHasher,
  field: PostingFieldName,
  slot: number | null,
  offending: unknown,
): void {
  expect(outcome.result).toBeUndefined();
  const error = outcome.error;
  expect(error).toBeInstanceOf(FieldRangeError);
  expect(error).not.toBeInstanceOf(RangeError);
  if (!(error instanceof FieldRangeError)) throw new Error('UNREACHABLE');
  expect(error.field).toBe(field);
  expect(error.slot).toBe(slot);
  // The message is the fixed label form for every case, tiny values included.
  const expected =
    slot === null ? `${LABELS[field]} OUT OF RANGE` : `${LABELS[field]} OUT OF RANGE AT SLOT ${slot}`;
  expect(error.message).toBe(expected);
  // Larger values: neither the decimal nor the 0x hexadecimal form appears anywhere on the error.
  const decimal = absDecimal(offending);
  if (decimal !== undefined && decimal.length >= 6) {
    const hex = typeof offending === 'bigint' ? `0x${(offending < 0n ? -offending : offending).toString(16)}` : undefined;
    for (const text of ownPropertyTexts(error)) {
      expect(text.includes(decimal)).toBe(false);
      if (hex !== undefined) expect(text.toLowerCase().includes(hex)).toBe(false);
    }
  }
  expect(spy.total()).toBe(0);
}

// ---------------------------------------------------------------------------

describe('witness-builder', () => {
  let env: HasherEnv;

  beforeAll(async () => {
    env = await createHasherEnv();
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await env.destroy();
  });

  describe('hashing goes through the Hasher (3.7)', () => {
    it('calls hashLeaf 64 times and hashNode 63 times, and the root equals an independent merkleRoot', async () => {
      const spy = spyOn(env.hasher);
      const built = await buildCircuitInputs(spy, { postings: realPostings(), limitCents: LIMIT_CENTS });
      expect(spy.leafCalls).toHaveLength(64);
      expect(spy.nodeCalls).toHaveLength(63);

      const leaves: bigint[] = [];
      for (const p of slotsOf(realPostings())) leaves.push(await env.hasher.hashLeaf(leafInputs(p)));
      const independent = await merkleRoot(env.hasher, leaves);
      expect(built.merkleRoot).toBe(independent);
      expect(built.inputs.merkle_root).toBe(independent.toString(10));
      expect(built.recordCount).toBe(3);
    });

    it('delegates all hashing: a fake hasher determines the root', async () => {
      const spy = spyOn(FAKE_HASHER);
      const built = await buildCircuitInputs(spy, { postings: realPostings(), limitCents: LIMIT_CENTS });
      const expected = await fakeRootOf(slotsOf(realPostings()));
      expect(built.merkleRoot).toBe(expected);
      expect(built.inputs.merkle_root).toBe(expected.toString(10));
      expect(spy.leafCalls).toHaveLength(64);
      expect(spy.nodeCalls).toHaveLength(63);

      const real = await buildCircuitInputs(env.hasher, { postings: realPostings(), limitCents: LIMIT_CENTS });
      expect(real.merkleRoot).not.toBe(built.merkleRoot);
    });

    it('feeds hashLeaf the six fields of each posting in circuit order', async () => {
      const spy = spyOn(FAKE_HASHER);
      await buildCircuitInputs(spy, { postings: realPostings(), limitCents: LIMIT_CENTS });
      realPostings().forEach((p, i) => {
        expect(spy.leafCalls[i]).toEqual(leafInputs(p));
      });
    });

    it('source check: no Poseidon code and no bb.js import in witness-builder.ts or circuit-inputs.ts', () => {
      for (const path of [BUILDER_PATH, CIRCUIT_INPUTS_PATH]) {
        const text = readFileSync(path, 'utf8');
        // Comments may name Poseidon (they say the file has none). Check code only.
        const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/poseidon|permut|\bmds\b|sbox/i);
        const specifiers = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] ?? '');
        expect(specifiers.length).toBeGreaterThan(0);
        for (const specifier of specifiers) {
          expect(specifier.startsWith('./')).toBe(true);
          expect(specifier).not.toMatch(/bb\.js|bb-js|@aztec/);
        }
      }
    });
  });

  describe('padding is the single PADDING_POSTING (3.9)', () => {
    it('slots 3..63 are the all-zero CircuitPosting and every padding leaf is PAD_LEAF', async () => {
      const spy = spyOn(env.hasher);
      const built = await buildCircuitInputs(spy, { postings: realPostings(), limitCents: LIMIT_CENTS });
      const zero = { record_id: '0', account: '0', side: '0', amount: '0', review_flag: '0', salt: '0' };
      for (let slot = 3; slot < CAPACITY; slot += 1) {
        expect(built.inputs.postings[slot]).toEqual(zero);
      }
      const padding = built.inputs.postings.slice(3);
      expect(padding).toHaveLength(61);
      for (const p of padding) expect(p).toEqual(at(padding, 0));

      for (let slot = 3; slot < CAPACITY; slot += 1) {
        expect(spy.leafCalls[slot]).toEqual([0n, 0n, 0n, 0n, 0n, 0n]);
        expect(spy.leafResults[slot]).toBe(PAD_LEAF);
      }
      // The three real leaves are not padding.
      for (let slot = 0; slot < 3; slot += 1) expect(spy.leafResults[slot]).not.toBe(PAD_LEAF);
    });

    it('64 PADDING_POSTING slots give EMPTY_ROOT, and both constants are recorded in noir.md', async () => {
      const built = await assembleCircuitInputs(env.hasher, slotsOf([]), 1, LIMIT_CENTS);
      expect(built.merkleRoot).toBe(EMPTY_ROOT);
      const noirMd = readFileSync(NOIR_MD_PATH, 'utf8').toLowerCase();
      for (const constant of [PAD_LEAF, EMPTY_ROOT]) {
        expect(noirMd.includes(`0x${constant.toString(16).padStart(64, '0')}`)).toBe(true);
      }
    });
  });

  describe('range rejections (3.10)', () => {
    interface FieldCase {
      readonly field: Exclude<PostingFieldName, 'limitCents' | 'recordCount'>;
      readonly name: string;
      readonly value: unknown;
    }
    const FIELD_CASES: readonly FieldCase[] = [
      { field: 'recordId', name: '2^64', value: 2n ** 64n },
      { field: 'recordId', name: '-1', value: -1n },
      { field: 'recordId', name: 'field modulus', value: FIELD_MODULUS },
      { field: 'recordId', name: 'number smuggled in', value: 100001 },
      { field: 'account', name: '2^64', value: 2n ** 64n },
      { field: 'account', name: '-1', value: -1n },
      { field: 'account', name: 'number smuggled in', value: 100000000001 },
      { field: 'side', name: '2', value: 2n },
      { field: 'side', name: '1000000', value: 1_000_000n },
      { field: 'side', name: 'number smuggled in', value: 1 },
      { field: 'amountCents', name: '2^40', value: 2n ** 40n },
      { field: 'amountCents', name: '-1', value: -1n },
      { field: 'amountCents', name: '2^53 - 1', value: 2n ** 53n - 1n },
      { field: 'amountCents', name: '2^53', value: 2n ** 53n },
      { field: 'amountCents', name: '2^53 + 1', value: 2n ** 53n + 1n },
      { field: 'amountCents', name: 'field modulus - 1', value: FIELD_MODULUS - 1n },
      { field: 'amountCents', name: 'field modulus', value: FIELD_MODULUS },
      { field: 'amountCents', name: 'field modulus + 1', value: FIELD_MODULUS + 1n },
      { field: 'amountCents', name: 'number smuggled in', value: 123456 },
      { field: 'reviewFlag', name: '2', value: 2n },
      { field: 'reviewFlag', name: '1000000', value: 1_000_000n },
      { field: 'reviewFlag', name: 'number smuggled in', value: 0 },
      { field: 'salt', name: '2^248', value: 2n ** 248n },
      { field: 'salt', name: '-1', value: -1n },
      { field: 'salt', name: 'field modulus', value: FIELD_MODULUS },
      { field: 'salt', name: 'number smuggled in', value: 900001 },
    ];
    // Slot 1 is a real posting, slot 40 is a padding slot: padding is range-validated too.
    const SLOTS = [1, 40] as const;

    for (const c of FIELD_CASES) {
      for (const slot of SLOTS) {
        it(`${c.field} ${c.name} at slot ${slot} throws FieldRangeError, hashes nothing`, async () => {
          const slots = slotsOf(realPostings());
          slots[slot] = withField(at(slots, slot), c.field, c.value);
          const spy = spyOn(env.hasher);
          const outcome = await attempt(() => assembleCircuitInputs(spy, slots, 3, LIMIT_CENTS));
          expectRangeRejection(outcome, spy, c.field, slot, c.value);
        });
      }
    }

    it('the same field cases through buildCircuitInputs (real slots only)', async () => {
      for (const c of FIELD_CASES) {
        const postings = realPostings();
        postings[2] = withField(at(postings, 2), c.field, c.value);
        const spy = spyOn(env.hasher);
        const outcome = await attempt(() => buildCircuitInputs(spy, { postings, limitCents: LIMIT_CENTS }));
        expectRangeRejection(outcome, spy, c.field, 2, c.value);
      }
    });

    it('accepts the inclusive upper bounds of every field and hashes them', async () => {
      const edge: Posting = {
        recordId: ID_MAX,
        account: ID_MAX,
        side: 1n,
        amountCents: 2n ** 40n - 1n,
        reviewFlag: 1n,
        salt: SALT_BOUND - 1n,
      };
      const spy = spyOn(env.hasher);
      const built = await buildCircuitInputs(spy, { postings: [edge], limitCents: 2n ** 40n - 1n });
      expect(built.recordCount).toBe(1);
      expect(spy.total()).toBe(127);
    });

    interface ScalarCase {
      readonly field: 'limitCents' | 'recordCount';
      readonly name: string;
      readonly value: unknown;
    }
    const LIMIT_CASES: readonly ScalarCase[] = [
      { field: 'limitCents', name: '2^40', value: 2n ** 40n },
      { field: 'limitCents', name: '-1', value: -1n },
      { field: 'limitCents', name: '2^53', value: 2n ** 53n },
      { field: 'limitCents', name: 'field modulus', value: FIELD_MODULUS },
      { field: 'limitCents', name: 'number smuggled in', value: 1_000_000 },
    ];
    const COUNT_CASES: readonly ScalarCase[] = [
      { field: 'recordCount', name: '0', value: 0 },
      { field: 'recordCount', name: '65', value: 65 },
      { field: 'recordCount', name: '-1', value: -1 },
      { field: 'recordCount', name: '1.5', value: 1.5 },
      { field: 'recordCount', name: 'NaN', value: Number.NaN },
      { field: 'recordCount', name: 'bigint smuggled in', value: 3n },
    ];

    for (const c of [...LIMIT_CASES, ...COUNT_CASES]) {
      it(`${c.field} ${c.name} throws FieldRangeError with slot null (assembleCircuitInputs)`, async () => {
        const spy = spyOn(env.hasher);
        const count: unknown = c.field === 'recordCount' ? c.value : 3;
        const limit: unknown = c.field === 'limitCents' ? c.value : LIMIT_CENTS;
        const outcome = await attempt(() =>
          assembleCircuitInputs(spy, slotsOf(realPostings()), count as number, limit as bigint),
        );
        expectRangeRejection(outcome, spy, c.field, null, c.value);
      });
    }

    for (const c of LIMIT_CASES) {
      it(`limitCents ${c.name} throws FieldRangeError (buildCircuitInputs)`, async () => {
        const spy = spyOn(env.hasher);
        const outcome = await attempt(() =>
          buildCircuitInputs(spy, { postings: realPostings(), limitCents: c.value as bigint }),
        );
        expectRangeRejection(outcome, spy, 'limitCents', null, c.value);
      });
    }

    it('0 real postings and 65 real postings throw recordCount through buildCircuitInputs', async () => {
      const spyZero = spyOn(env.hasher);
      const zero = await attempt(() => buildCircuitInputs(spyZero, { postings: [], limitCents: LIMIT_CENTS }));
      expectRangeRejection(zero, spyZero, 'recordCount', null, 0);

      const spyOver = spyOn(env.hasher);
      const postings = Array.from({ length: 65 }, () => at(realPostings(), 0));
      const over = await attempt(() => buildCircuitInputs(spyOver, { postings, limitCents: LIMIT_CENTS }));
      expectRangeRejection(over, spyOver, 'recordCount', null, 65);
    });

    it('64 real postings are accepted (upper bound of recordCount)', async () => {
      const postings = Array.from({ length: 64 }, () => at(realPostings(), 0));
      const built = await buildCircuitInputs(spyOn(FAKE_HASHER), { postings, limitCents: LIMIT_CENTS });
      expect(built.recordCount).toBe(64);
      expect(built.inputs.record_count).toBe('64');
    });

    it('reports the lowest slot first when two slots are invalid', async () => {
      const slots = slotsOf(realPostings());
      slots[5] = withField(at(slots, 5), 'salt', 2n ** 248n);
      slots[2] = withField(at(slots, 2), 'amountCents', 2n ** 40n);
      slots[60] = withField(at(slots, 60), 'recordId', 2n ** 64n);
      const spy = spyOn(env.hasher);
      const outcome = await attempt(() => assembleCircuitInputs(spy, slots, 3, LIMIT_CENTS));
      expectRangeRejection(outcome, spy, 'amountCents', 2, 2n ** 40n);
    });

    it('reports fields of one slot in the order recordId, account, side, amountCents, reviewFlag, salt', async () => {
      const bad: Readonly<Record<keyof Posting, unknown>> = {
        recordId: 2n ** 64n,
        account: 2n ** 64n,
        side: 2n,
        amountCents: 2n ** 40n,
        reviewFlag: 2n,
        salt: 2n ** 248n,
      };
      const order: readonly (keyof Posting)[] = ['recordId', 'account', 'side', 'amountCents', 'reviewFlag', 'salt'];
      for (let first = 0; first < order.length; first += 1) {
        let posting = at(realPostings(), 1);
        for (const field of order.slice(first)) posting = withField(posting, field, bad[field]);
        const slots = slotsOf(realPostings());
        slots[1] = posting;
        const spy = spyOn(env.hasher);
        const outcome = await attempt(() => assembleCircuitInputs(spy, slots, 3, LIMIT_CENTS));
        const field = at(order, first);
        expectRangeRejection(outcome, spy, field, 1, bad[field]);
      }
    });

    it('validates recordCount, then limitCents, before any slot', async () => {
      const slots = slotsOf(realPostings());
      slots[0] = withField(at(slots, 0), 'recordId', 2n ** 64n);

      const spyBoth = spyOn(env.hasher);
      const both = await attempt(() => assembleCircuitInputs(spyBoth, slots, 0, 2n ** 40n));
      expectRangeRejection(both, spyBoth, 'recordCount', null, 0);

      const spyLimit = spyOn(env.hasher);
      const limit = await attempt(() => assembleCircuitInputs(spyLimit, slots, 3, 2n ** 40n));
      expectRangeRejection(limit, spyLimit, 'limitCents', null, 2n ** 40n);

      const spySlot = spyOn(env.hasher);
      const slot = await attempt(() => assembleCircuitInputs(spySlot, slots, 3, LIMIT_CENTS));
      expectRangeRejection(slot, spySlot, 'recordId', 0, 2n ** 64n);
    });
  });

  describe('assembleCircuitInputs', () => {
    it('requires exactly 64 slots', async () => {
      for (const count of [63, 65]) {
        const slots = Array.from({ length: count }, () => PADDING_POSTING);
        const spy = spyOn(env.hasher);
        const outcome = await attempt(() => assembleCircuitInputs(spy, slots, 1, LIMIT_CENTS));
        expect(outcome.result).toBeUndefined();
        expect(outcome.error).toBeInstanceOf(Error);
        expect(outcome.error).not.toBeInstanceOf(FieldRangeError);
        expect((outcome.error as Error).message).toBe('WITNESS SLOT COUNT MUST BE 64');
        expect(spy.total()).toBe(0);
      }
    });

    it('rootOverride replaces the root in the map and in the result', async () => {
      const slots = slotsOf(realPostings());
      const honest = await assembleCircuitInputs(env.hasher, slots, 3, LIMIT_CENTS);
      const override = honest.merkleRoot + 1n;
      const forged = await assembleCircuitInputs(env.hasher, slots, 3, LIMIT_CENTS, override);
      expect(forged.merkleRoot).toBe(override);
      expect(forged.inputs.merkle_root).toBe(override.toString(10));
      expect(forged.inputs.postings).toEqual(honest.inputs.postings);
    });

    it('rejects a rootOverride that is not a field element, with a fixed message and no hasher call', async () => {
      for (const override of [FIELD_MODULUS, FIELD_MODULUS + 123456789n, -1n]) {
        const spy = spyOn(env.hasher);
        const outcome = await attempt(() =>
          assembleCircuitInputs(spy, slotsOf(realPostings()), 3, LIMIT_CENTS, override),
        );
        expect(outcome.result).toBeUndefined();
        expect(outcome.error).toBeInstanceOf(Error);
        if (!(outcome.error instanceof Error)) throw new Error('UNREACHABLE');
        expect(outcome.error.message).toBe('MERKLE ROOT OVERRIDE NOT A FIELD ELEMENT');
        for (const text of ownPropertyTexts(outcome.error)) {
          expect(text.includes(override.toString(10))).toBe(false);
        }
        expect(spy.total()).toBe(0);
      }
    });

    it('accepts the largest field element as rootOverride', async () => {
      const built = await assembleCircuitInputs(spyOn(FAKE_HASHER), slotsOf(realPostings()), 3, LIMIT_CENTS, FIELD_MODULUS - 1n);
      expect(built.merkleRoot).toBe(FIELD_MODULUS - 1n);
    });
  });

  describe('circuit input map', () => {
    function expectMapShape(inputs: CircuitInputs, recordCount: number): void {
      expect(Object.keys(inputs).sort()).toEqual(['limit_cents', 'merkle_root', 'postings', 'record_count']);
      expect(inputs.postings).toHaveLength(64);
      for (const p of inputs.postings) {
        expect(Object.keys(p).sort()).toEqual(['account', 'amount', 'record_id', 'review_flag', 'salt', 'side']);
        for (const value of Object.values(p)) {
          expect(typeof value).toBe('string');
          expect(value).toMatch(DECIMAL);
        }
      }
      for (const value of [inputs.merkle_root, inputs.record_count, inputs.limit_cents]) {
        expect(typeof value).toBe('string');
        expect(value).toMatch(DECIMAL);
      }
      expect(inputs.record_count).toBe(String(recordCount));
    }

    it('has exactly the circuit keys, decimal strings, and record_count equal to the real postings', async () => {
      const built = await buildCircuitInputs(env.hasher, { postings: realPostings(), limitCents: LIMIT_CENTS });
      expectMapShape(built.inputs, 3);
      expect(built.inputs.limit_cents).toBe('1000000');
      expect(built.inputs.postings[0]).toEqual({
        record_id: '100001',
        account: '100000000001',
        side: '0',
        amount: '100000',
        review_flag: '0',
        salt: '900001',
      });
      expect(built.inputs.postings[2]?.review_flag).toBe('1');
    });

    it('keeps the shape for the smallest and largest batches', async () => {
      const one = await buildCircuitInputs(FAKE_HASHER, { postings: [at(realPostings(), 0)], limitCents: 0n });
      expectMapShape(one.inputs, 1);
      expect(one.inputs.limit_cents).toBe('0');
      const full = await buildCircuitInputs(FAKE_HASHER, {
        postings: Array.from({ length: 64 }, () => at(realPostings(), 0)),
        limitCents: LIMIT_CENTS,
      });
      expectMapShape(full.inputs, 64);
    });
  });
});

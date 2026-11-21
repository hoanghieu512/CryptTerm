import { abiEncode } from '@noir-lang/noirc_abi';
import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import type { AbiParameter, AbiType } from '@noir-lang/types';
import type { CircuitInputs } from '../../src/zk/circuit-inputs';
import { CAPACITY } from '../../src/ledger/field';
import { PADDING_POSTING } from '../../src/ledger/posting';
import type { Posting } from '../../src/ledger/posting';
import { assembleCircuitInputs, buildCircuitInputs } from '../../src/zk/witness-builder';
import { createHasherEnv, createNoirEnv } from '../support/zk-env';
import type { HasherEnv, NoirEnv } from '../support/zk-env';

// Requirements 2.4, 2.5 (ABI shape), 2.9 (missing public input, wrong array length), 9.5, 9.6
// (Node pre-check of what `Noir.execute` does when a constraint fails, design Q5).
// Example test. All values are synthetic. Nothing here makes a network request, and nothing prints
// a posting value: the report lines hold shape facts, the circuit's own fixed assertion text and
// field NAMES only.

const WASM_TIMEOUT_MS = 120_000;
const LIMIT_CENTS = 1_000_000n;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function posting(
  n: bigint,
  side: 0n | 1n,
  amountCents: bigint,
  reviewFlag: 0n | 1n = 0n,
): Posting {
  // Every value is at least 100000 so that a whole-token value check is meaningful.
  return {
    recordId: 100000n + n,
    account: 100000000000n + n,
    side,
    amountCents,
    reviewFlag,
    salt: 900000n + n,
  };
}

/** Four real postings: debits 300000 and 200000, credits 350000 and 150000. Balanced, under limit. */
function validPostings(): Posting[] {
  return [
    posting(1n, 0n, 300000n),
    posting(2n, 0n, 200000n),
    posting(3n, 1n, 350000n),
    posting(4n, 1n, 150000n),
  ];
}

function padTo64(real: readonly Posting[]): Posting[] {
  return [...real, ...Array.from({ length: CAPACITY - real.length }, () => PADDING_POSTING)];
}

function at<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error('TEST FIXTURE INDEX OUT OF RANGE');
  return item;
}

// ---------------------------------------------------------------------------
// Pure helpers for the report
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAlphanumeric(ch: string): boolean {
  return /^[A-Za-z0-9]$/.test(ch);
}

/**
 * True if `token` occurs in `text` as a whole token: the characters just before and after the
 * occurrence are not letters or digits (or the occurrence touches the start or end of the text).
 * Case-insensitive, so hex digits match in either case. An empty token never matches.
 */
function containsWholeToken(text: string, token: string): boolean {
  if (token.length === 0) return false;
  const haystack = text.toLowerCase();
  const needle = token.toLowerCase();
  let from = 0;
  for (;;) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) return false;
    const before = found === 0 ? '' : haystack.charAt(found - 1);
    const after = haystack.charAt(found + needle.length);
    if (!isAlphanumeric(before) && !isAlphanumeric(after)) return true;
    from = found + 1;
  }
}

type PrivateFieldName = 'record_id' | 'account' | 'amount' | 'salt';

/** The spellings of one private value that can show up in text: decimal, `0x` hex, 64-digit `0x` hex. */
function spellings(v: bigint): string[] {
  const hex = v.toString(16);
  return [v.toString(10), `0x${hex}`, `0x${hex.padStart(64, '0')}`];
}

/**
 * The names of the private fields (`record_id`, `account`, `amount`, `salt`) of the real postings
 * whose value occurs in `text` as a whole token, in decimal or `0x` hex form. Each name once.
 */
function leakedFieldNames(text: string, postings: readonly Posting[]): PrivateFieldName[] {
  const fields: Record<PrivateFieldName, bigint[]> = {
    record_id: postings.map((p) => p.recordId),
    account: postings.map((p) => p.account),
    amount: postings.map((p) => p.amountCents),
    salt: postings.map((p) => p.salt),
  };
  const names: PrivateFieldName[] = ['record_id', 'account', 'amount', 'salt'];
  return names.filter((name) =>
    fields[name].some((v) => spellings(v).some((s) => containsWholeToken(text, s))),
  );
}

/** Text of an own property value for the leak scan. Never throws. */
function propertyText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString(10) : v)) ?? '';
  } catch {
    return '';
  }
}

interface ErrorShape {
  readonly threw: boolean;
  readonly constructorName: string;
  readonly ownPropertyNames: readonly string[];
  readonly message: string;
  /** Own property names that hold call-stack or payload information. */
  readonly debugPropertyNames: readonly string[];
  /** Private field names found in the message. */
  readonly leaksInMessage: readonly PrivateFieldName[];
  /** Private field names found in any own property (message and stack included). */
  readonly leaksInAnyOwnProperty: readonly PrivateFieldName[];
  /**
   * `name=value` for every own property except `stack` and `message`. Empty when a private value was
   * found in any own property, so that the report never prints one.
   */
  readonly debugDetail: readonly string[];
}

const NO_ERROR: ErrorShape = {
  threw: false,
  constructorName: '',
  ownPropertyNames: [],
  message: '',
  debugPropertyNames: [],
  leaksInMessage: [],
  leaksInAnyOwnProperty: [],
  debugDetail: [],
};

function describeError(error: unknown, postings: readonly Posting[]): ErrorShape {
  if (!isRecord(error)) {
    return { ...NO_ERROR, threw: true, constructorName: typeof error };
  }
  const proto: unknown = Object.getPrototypeOf(error);
  const ctor = isRecord(proto) ? proto['constructor'] : undefined;
  const constructorName = typeof ctor === 'function' ? ctor.name : 'UNKNOWN';
  const ownPropertyNames = Object.getOwnPropertyNames(error);
  const message = typeof error['message'] === 'string' ? error['message'] : '';
  const everything = ownPropertyNames.map((name) => propertyText(error[name])).join('\n');
  const leaksInAnyOwnProperty = leakedFieldNames(everything, postings);
  const debugDetail =
    leaksInAnyOwnProperty.length > 0
      ? []
      : ownPropertyNames
          .filter((n) => n !== 'stack' && n !== 'message')
          .map((n) => `${n}=${propertyText(error[n])}`);
  return {
    threw: true,
    constructorName,
    ownPropertyNames,
    message,
    debugPropertyNames: ownPropertyNames.filter((n) => /stack|payload|opcode|brillig|acir/i.test(n)),
    leaksInMessage: leakedFieldNames(message, postings),
    leaksInAnyOwnProperty,
    debugDetail,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('containsWholeToken and leakedFieldNames (pure)', () => {
  it('matches whole tokens only, in decimal and hex, with any non-alphanumeric delimiter', () => {
    expect(containsWholeToken('amount 300000.', '300000')).toBe(true);
    expect(containsWholeToken('300000', '300000')).toBe(true);
    expect(containsWholeToken('a_300000_b', '300000')).toBe(true);
    expect(containsWholeToken('x3000001', '300000')).toBe(false);
    expect(containsWholeToken('1300000', '300000')).toBe(false);
    expect(containsWholeToken('v=0x493E0;', '0x493e0')).toBe(true);
    expect(containsWholeToken('0x493e00', '0x493e0')).toBe(false);
    expect(containsWholeToken('anything', '')).toBe(false);
    // The second occurrence is a whole token even if the first is not.
    expect(containsWholeToken('1300000 and 300000', '300000')).toBe(true);
  });

  it('reports the private field names that occur, each once', () => {
    const real = validPostings();
    const first = at(real, 0);
    expect(leakedFieldNames('nothing here', real)).toEqual([]);
    expect(leakedFieldNames(`amount ${first.amountCents.toString(10)}`, real)).toEqual(['amount']);
    expect(leakedFieldNames(`salt 0x${first.salt.toString(16)}`, real)).toEqual(['salt']);
    expect(
      leakedFieldNames(`${first.recordId.toString(10)} ${first.account.toString(10)}`, real),
    ).toEqual(['record_id', 'account']);
  });
});

describe('ledger_audit circuit inputs (Requirements 2.4, 2.5, 2.9) and the Node execute experiment (Q5)', () => {
  let hasherEnv: HasherEnv;
  let noirEnv: NoirEnv;
  let valid: CircuitInputs;
  const reportLines: string[] = [];

  beforeAll(async () => {
    hasherEnv = await createHasherEnv();
    noirEnv = createNoirEnv();
    const built = await buildCircuitInputs(hasherEnv.hasher, {
      postings: validPostings(),
      limitCents: LIMIT_CENTS,
    });
    valid = built.inputs;
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await hasherEnv.destroy();
    if (reportLines.length > 0) {
      process.stdout.write(`${reportLines.join('\n')}\n`);
    }
  });

  describe('ABI shape of the committed Artifact (2.4, 2.5)', () => {
    function parameter(name: string): AbiParameter {
      const found = noirEnv.artifact.abi.parameters.find((p) => p.name === name);
      if (found === undefined) throw new Error(`ABI PARAMETER MISSING: ${name}`);
      return found;
    }

    it('has exactly the three public inputs and one private postings parameter, and no return value', () => {
      const { parameters, return_type: returnType } = noirEnv.artifact.abi;
      expect(parameters.map((p) => p.name)).toEqual([
        'merkle_root',
        'record_count',
        'limit_cents',
        'postings',
      ]);
      expect(parameters.filter((p) => p.visibility === 'public').map((p) => p.name)).toEqual([
        'merkle_root',
        'record_count',
        'limit_cents',
      ]);
      expect(parameters.filter((p) => p.visibility !== 'public').map((p) => p.name)).toEqual([
        'postings',
      ]);
      expect(parameter('postings').visibility).toBe('private');
      expect(returnType).toBeNull();
    });

    it('types the public inputs as field, u32 and u64', () => {
      const field: AbiType = { kind: 'field' };
      expect(parameter('merkle_root').type).toEqual(field);
      expect(parameter('record_count').type).toEqual({ kind: 'integer', sign: 'unsigned', width: 32 });
      expect(parameter('limit_cents').type).toEqual({ kind: 'integer', sign: 'unsigned', width: 64 });
    });

    it('types postings as 64 structs with exactly the six private posting fields', () => {
      const type = parameter('postings').type;
      if (type.kind !== 'array') throw new Error('postings is not an array');
      expect(type.length).toBe(64);
      expect(type.length).toBe(CAPACITY);
      const element = type.type;
      if (element.kind !== 'struct') throw new Error('postings element is not a struct');
      expect(element.fields).toEqual([
        { name: 'record_id', type: { kind: 'field' } },
        { name: 'account', type: { kind: 'field' } },
        { name: 'side', type: { kind: 'integer', sign: 'unsigned', width: 8 } },
        { name: 'amount', type: { kind: 'integer', sign: 'unsigned', width: 64 } },
        { name: 'review_flag', type: { kind: 'integer', sign: 'unsigned', width: 8 } },
        { name: 'salt', type: { kind: 'field' } },
      ]);
    });
  });

  describe('malformed input maps are rejected by the ABI encoder (2.9)', () => {
    const abi = (): NoirEnv['artifact']['abi'] => noirEnv.artifact.abi;

    it('positive control: the valid batch encodes and executes without throwing', async () => {
      expect(() => abiEncode(abi(), valid)).not.toThrow();
      const result = await noirEnv.noir.execute(valid);
      expect(result.witness.length).toBeGreaterThan(0);
    });

    it('throws when any one of the three public inputs is missing', async () => {
      const { merkle_root: _r, ...withoutRoot } = valid;
      const { record_count: _c, ...withoutCount } = valid;
      const { limit_cents: _l, ...withoutLimit } = valid;
      for (const inputs of [withoutRoot, withoutCount, withoutLimit]) {
        expect(() => abiEncode(abi(), inputs)).toThrow();
        await expect(noirEnv.noir.execute(inputs)).rejects.toThrow();
      }
    });

    it('throws for 63 postings and for 65 postings', async () => {
      const postings = valid.postings;
      const tooFew = { ...valid, postings: postings.slice(0, 63) };
      const tooMany = { ...valid, postings: [...postings, at(postings, 63)] };
      expect(tooFew.postings).toHaveLength(63);
      expect(tooMany.postings).toHaveLength(65);
      for (const inputs of [tooFew, tooMany]) {
        expect(() => abiEncode(abi(), inputs)).toThrow();
        await expect(noirEnv.noir.execute(inputs)).rejects.toThrow();
      }
    });
  });

  describe('Q5: what `noir.execute` does when a constraint fails (Node pre-check, not the browser result)', () => {
    interface Case {
      readonly label: string;
      readonly assertion: string;
      readonly postings: readonly Posting[];
      readonly shape: ErrorShape;
    }

    async function runCase(
      label: string,
      assertion: string,
      real: readonly Posting[],
      rootDelta = 0n,
    ): Promise<Case> {
      // `assembleCircuitInputs` recomputes every leaf and the root from the supplied slots, so the
      // root constraint passes unless `rootDelta` is non-zero.
      const honest = await assembleCircuitInputs(hasherEnv.hasher, padTo64(real), real.length, LIMIT_CENTS);
      const built =
        rootDelta === 0n
          ? honest
          : await assembleCircuitInputs(
              hasherEnv.hasher,
              padTo64(real),
              real.length,
              LIMIT_CENTS,
              honest.merkleRoot + rootDelta,
            );
      let shape: ErrorShape = NO_ERROR;
      try {
        await noirEnv.noir.execute(built.inputs);
      } catch (error) {
        shape = describeError(error, real);
      }
      const row =
        `NODE EXECUTE ${label}: THREW=${shape.threw ? 'YES' : 'NO'}` +
        ` CONSTRUCTOR=${shape.constructorName}` +
        ` OWN_PROPERTIES=[${shape.ownPropertyNames.join(',')}]` +
        ` DEBUG_PROPERTIES=[${shape.debugPropertyNames.join(',')}]` +
        ` MESSAGE=${JSON.stringify(shape.message)}` +
        ` ASSERTION_IN_MESSAGE=${shape.message.includes(assertion) ? 'YES' : 'NO'}` +
        ` PRIVATE_IN_MESSAGE=[${shape.leaksInMessage.join(',')}]` +
        ` PRIVATE_IN_ANY_OWN_PROPERTY=[${shape.leaksInAnyOwnProperty.join(',')}]` +
        ` DETAIL=${shape.debugDetail.join(' | ')}`;
      reportLines.push(row);
      return { label, assertion, postings: real, shape };
    }

    let unbalanced: Case;
    let wrongRoot: Case;
    let overLimit: Case;

    beforeAll(async () => {
      const base = validPostings();
      // One cent on slot 0: leaves and root are recomputed, so only the balance constraint rejects.
      const first = at(base, 0);
      const modified: Posting[] = [{ ...first, amountCents: first.amountCents + 1n }, ...base.slice(1)];
      unbalanced = await runCase('UNBALANCED', 'DEBITS NOT EQUAL TO CREDITS', modified);
      wrongRoot = await runCase('WRONG ROOT', 'MERKLE ROOT MISMATCH', base, 1n);
      // Slot 0 debit and slot 1 credit of LIMIT + 1, only the credit flagged: balanced, root honest.
      const overLimitBatch: Posting[] = [
        posting(1n, 0n, LIMIT_CENTS + 1n, 0n),
        posting(2n, 1n, LIMIT_CENTS + 1n, 1n),
        posting(3n, 0n, 200000n),
        posting(4n, 1n, 200000n),
      ];
      overLimit = await runCase('OVER LIMIT UNFLAGGED', 'OVER LIMIT WITHOUT REVIEW FLAG', overLimitBatch);
    }, WASM_TIMEOUT_MS);

    // Observed in Node on noir_js 1.0.0 (2026-11-21): `execute` THROWS at the failed constraint, the
    // error is a plain `Error` whose message is `Circuit execution failed: <assertion text>`, and no
    // private value appears in the message or in any own property. The assertions below pin those
    // observed facts, so a change in a future version is noticed (a change is not necessarily a bug).
    it('execute throws for the one-cent-modified witness (unbalanced) with the balance assertion', () => {
      expect(unbalanced.shape.threw).toBe(true);
      expect(unbalanced.shape.message).toContain('DEBITS NOT EQUAL TO CREDITS');
    });

    it('execute throws for a wrong root with the root assertion', () => {
      expect(wrongRoot.shape.threw).toBe(true);
      expect(wrongRoot.shape.message).toContain('MERKLE ROOT MISMATCH');
    });

    it('execute throws for an over-limit unflagged posting with the limit assertion', () => {
      expect(overLimit.shape.threw).toBe(true);
      expect(overLimit.shape.message).toContain('OVER LIMIT WITHOUT REVIEW FLAG');
    });

    it('the message is "Circuit execution failed: " plus the fixed assertion text, for all three cases', () => {
      for (const c of [unbalanced, wrongRoot, overLimit]) {
        expect(c.shape.message).toBe(`Circuit execution failed: ${c.assertion}`);
      }
    });

    it('observed: no private value (record_id, account, amount, salt) is in the message or any own property', () => {
      // If a future version echoes a value, this assertion fails and the change is noticed.
      for (const c of [unbalanced, wrongRoot, overLimit]) {
        expect(c.shape.leaksInMessage).toEqual([]);
        expect(c.shape.leaksInAnyOwnProperty).toEqual([]);
      }
    });

    it('the error shape is the same for the three violations', () => {
      for (const c of [wrongRoot, overLimit]) {
        expect(c.shape.constructorName).toBe(unbalanced.shape.constructorName);
        expect(c.shape.ownPropertyNames).toEqual(unbalanced.shape.ownPropertyNames);
      }
      expect(unbalanced.shape.constructorName).toBe('Error');
      expect(unbalanced.shape.ownPropertyNames).toEqual(
        expect.arrayContaining(['stack', 'message', 'rawAssertionPayload', 'noirCallStack']),
      );
    });
  });
});

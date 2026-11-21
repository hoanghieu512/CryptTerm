import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS } from '../../src/zk/field';
import { SIDE_CREDIT, SIDE_DEBIT } from '../../src/zk/posting';
import type { Posting } from '../../src/zk/posting';
import { SPIKE_WITNESS } from '../../src/zk/spike-witness';
import { buildCircuitInputs } from '../../src/zk/witness-builder';
import { createHasherEnv, createNoirEnv } from '../support/zk-env';
import type { HasherEnv, NoirEnv } from '../support/zk-env';

// Requirements 8.3 (executes in Node), 8.4 (label), 9.1 (modified first slot still within the
// limit), 10.6 (no key material), 10.7 (synthetic values only).
// Example test. The witness is synthetic. Nothing here makes a network request or prints a value.
// The luhn scan of a card number is deferred to zk-core: a 12-digit account cannot be a card number.

const WASM_TIMEOUT_MS = 120_000;
const SOURCE_PATH = fileURLToPath(new URL('../../src/zk/spike-witness.ts', import.meta.url));
const LABEL = 'SYNTHETIC DEMO DATA';
const MIN_TOKEN = 100000n;

// ---------------------------------------------------------------------------
// The validator. Pure. Returns the names of the rules that the candidate breaks.
// ---------------------------------------------------------------------------

interface Candidate {
  readonly sourceText: string;
  readonly postings: readonly Posting[];
  readonly limitCents: bigint;
  readonly frozen: boolean;
}

const FORBIDDEN_KEY_WORDS: readonly string[] = [
  'PRIVATE KEY',
  'BEGIN ',
  'secretKey',
  'privateKey',
  'ed25519',
  'sign(',
];
const FORBIDDEN_API_WORDS: readonly string[] = ['fetch', 'console', 'localStorage'];

function firstLine(text: string): string {
  const end = text.indexOf('\n');
  return end === -1 ? text : text.slice(0, end);
}

function containsAnyIgnoreCase(text: string, words: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

function digitCount(v: bigint): number {
  return v.toString(10).length;
}

function validate(c: Candidate): string[] {
  const violations = new Set<string>();

  if (!firstLine(c.sourceText).includes(LABEL)) violations.add('LABEL MISSING');
  if (containsAnyIgnoreCase(c.sourceText, FORBIDDEN_KEY_WORDS)) violations.add('KEY MATERIAL');
  if (containsAnyIgnoreCase(c.sourceText, FORBIDDEN_API_WORDS)) violations.add('FORBIDDEN API');
  if (!c.frozen) violations.add('NOT FROZEN');
  if (c.postings.length !== 64) violations.add('POSTING COUNT');

  let debitTotalCents = 0n;
  let creditTotalCents = 0n;
  for (const p of c.postings) {
    if (
      p.recordId < MIN_TOKEN ||
      p.account < MIN_TOKEN ||
      p.amountCents < MIN_TOKEN ||
      p.salt < MIN_TOKEN
    ) {
      violations.add('VALUE BELOW 100000');
    }
    if (digitCount(p.account) !== 12) violations.add('ACCOUNT NOT 12 DIGITS');
    if (p.amountCents >= AMOUNT_BOUND_CENTS) violations.add('AMOUNT ABOVE 2^40');
    const overLimit = p.amountCents > c.limitCents;
    if (overLimit && p.reviewFlag !== 1n) violations.add('OVER LIMIT UNFLAGGED');
    if (!overLimit && p.reviewFlag === 1n) violations.add('FLAG WITHIN LIMIT');
    if (p.side === SIDE_DEBIT) debitTotalCents += p.amountCents;
    else if (p.side === SIDE_CREDIT) creditTotalCents += p.amountCents;
  }
  if (debitTotalCents !== creditTotalCents) violations.add('UNBALANCED');

  const first = c.postings[0];
  if (first === undefined || first.amountCents + 1n > c.limitCents) {
    violations.add('SLOT 0 PLUS ONE CENT OVER LIMIT');
  }
  return [...violations];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function at<T>(items: readonly T[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error('TEST FIXTURE INDEX OUT OF RANGE');
  return item;
}

function isDeepFrozen(): boolean {
  return Object.isFrozen(SPIKE_WITNESS) && Object.isFrozen(SPIKE_WITNESS.postings) &&
    SPIKE_WITNESS.postings.every((p) => Object.isFrozen(p));
}

const SOURCE_TEXT = readFileSync(SOURCE_PATH, 'utf8');

function genuine(): Candidate {
  return {
    sourceText: SOURCE_TEXT,
    postings: SPIKE_WITNESS.postings,
    limitCents: SPIKE_WITNESS.limitCents,
    frozen: isDeepFrozen(),
  };
}

/** A frozen in-memory copy with `edit` applied to the postings, so only the edited rule can fire. */
function mutated(
  edit: (postings: Posting[]) => void,
  sourceText: string = SOURCE_TEXT,
): Candidate {
  const postings = SPIKE_WITNESS.postings.map((p) => ({ ...p }));
  edit(postings);
  for (const p of postings) Object.freeze(p);
  return {
    sourceText,
    postings: Object.freeze(postings),
    limitCents: SPIKE_WITNESS.limitCents,
    frozen: true,
  };
}

function setSlot(postings: Posting[], slot: number, patch: Partial<Posting>): void {
  postings[slot] = { ...at(postings, slot), ...patch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Spike_Witness execution (Requirement 8.3)', () => {
  let hasherEnv: HasherEnv;
  let noirEnv: NoirEnv;

  beforeAll(async () => {
    hasherEnv = await createHasherEnv();
    noirEnv = createNoirEnv();
  }, WASM_TIMEOUT_MS);

  afterAll(async () => {
    await hasherEnv.destroy();
  }, WASM_TIMEOUT_MS);

  it('has 64 postings and record count 64', () => {
    expect(SPIKE_WITNESS.postings).toHaveLength(64);
    expect(SPIKE_WITNESS.recordCount).toBe(64);
  });

  it(
    'executes through noir.execute without error',
    async () => {
      const built = await buildCircuitInputs(hasherEnv.hasher, {
        postings: SPIKE_WITNESS.postings,
        limitCents: SPIKE_WITNESS.limitCents,
      });
      expect(built.inputs.record_count).toBe('64');
      expect(built.inputs.limit_cents).toBe('1000000');
      expect(built.inputs.postings).toHaveLength(64);
      const result = await noirEnv.noir.execute(built.inputs);
      expect(result.witness.length).toBeGreaterThan(0);
    },
    WASM_TIMEOUT_MS,
  );
});

describe('Spike_Witness content rules', () => {
  it('passes the validator unchanged', () => {
    expect(validate(genuine())).toEqual([]);
  });

  it('has the label on the first line of the source file (Requirement 8.4)', () => {
    expect(firstLine(SOURCE_TEXT)).toContain(LABEL);
  });

  it('keeps every recordId, account, amount and salt at least 100000', () => {
    for (const p of SPIKE_WITNESS.postings) {
      expect(p.recordId >= MIN_TOKEN).toBe(true);
      expect(p.account >= MIN_TOKEN).toBe(true);
      expect(p.amountCents >= MIN_TOKEN).toBe(true);
      expect(p.salt >= MIN_TOKEN).toBe(true);
    }
  });

  it('gives every account exactly 12 digits, so none can be a 13 to 19 digit card number', () => {
    for (const p of SPIKE_WITNESS.postings) {
      expect(digitCount(p.account)).toBe(12);
      expect(digitCount(p.account) >= 13).toBe(false);
    }
  });

  it('keeps every amount below 2^40', () => {
    for (const p of SPIKE_WITNESS.postings) {
      expect(p.amountCents < AMOUNT_BOUND_CENTS).toBe(true);
    }
  });

  it('follows the fixed formula for the first slots and the first flagged pair', () => {
    const slot0 = at(SPIKE_WITNESS.postings, 0);
    expect(slot0.recordId).toBe(100000001n);
    expect(slot0.account).toBe(900000000000n);
    expect(slot0.salt).toBe(5000000000n);
    expect(slot0.side).toBe(SIDE_DEBIT);
    expect(slot0.amountCents).toBe(150000n);
    const slot15 = at(SPIKE_WITNESS.postings, 15); // pair k = 7
    expect(slot15.side).toBe(SIDE_CREDIT);
    expect(slot15.amountCents).toBe(1250007n);
    expect(slot15.reviewFlag).toBe(1n);
  });

  it('keeps slot 0 plus one cent within the limit (Requirement 9.1)', () => {
    expect(at(SPIKE_WITNESS.postings, 0).amountCents + 1n <= SPIKE_WITNESS.limitCents).toBe(true);
  });

  it('balances debits against credits', () => {
    let debitCents = 0n;
    let creditCents = 0n;
    for (const p of SPIKE_WITNESS.postings) {
      if (p.side === SIDE_DEBIT) debitCents += p.amountCents;
      else creditCents += p.amountCents;
    }
    expect(debitCents).toBe(creditCents);
  });

  it('flags exactly the postings above the limit', () => {
    const flagged = SPIKE_WITNESS.postings.filter((p) => p.reviewFlag === 1n);
    const overLimit = SPIKE_WITNESS.postings.filter((p) => p.amountCents > SPIKE_WITNESS.limitCents);
    expect(flagged).toHaveLength(8);
    expect(overLimit).toEqual(flagged);
  });

  it('is frozen, with frozen postings', () => {
    expect(isDeepFrozen()).toBe(true);
  });
});

describe('Spike_Witness source file (Requirement 10.6)', () => {
  it('holds no key material and no network, log or storage word', () => {
    for (const word of [...FORBIDDEN_KEY_WORDS, ...FORBIDDEN_API_WORDS]) {
      expect(SOURCE_TEXT.toLowerCase().includes(word.toLowerCase())).toBe(false);
    }
  });
});

describe('validator negative controls', () => {
  const cases: ReadonlyArray<{ name: string; candidate: () => Candidate; expected: string }> = [
    {
      name: 'an account with 13 digits',
      candidate: () => mutated((p) => setSlot(p, 5, { account: 9000000000000n })),
      expected: 'ACCOUNT NOT 12 DIGITS',
    },
    {
      name: 'an amount below 100000 on a balanced pair',
      candidate: () =>
        mutated((p) => {
          setSlot(p, 0, { amountCents: 99999n });
          setSlot(p, 1, { amountCents: 99999n });
        }),
      expected: 'VALUE BELOW 100000',
    },
    {
      name: 'a source without the label on line 1',
      candidate: () =>
        mutated(() => undefined, `// DEMO\n// ${LABEL} on line 2\n${SOURCE_TEXT.split('\n').slice(1).join('\n')}`),
      expected: 'LABEL MISSING',
    },
    {
      name: 'a posting over the limit without a flag',
      candidate: () => mutated((p) => setSlot(p, 14, { reviewFlag: 0n })),
      expected: 'OVER LIMIT UNFLAGGED',
    },
    {
      name: 'a flag on a posting within the limit',
      candidate: () => mutated((p) => setSlot(p, 2, { reviewFlag: 1n })),
      expected: 'FLAG WITHIN LIMIT',
    },
    {
      name: 'an unbalanced pair',
      candidate: () => mutated((p) => setSlot(p, 1, { amountCents: 150001n })),
      expected: 'UNBALANCED',
    },
    {
      name: 'a source with PRIVATE KEY',
      candidate: () => mutated(() => undefined, `${SOURCE_TEXT}\n// -----BEGIN PRIVATE KEY-----`),
      expected: 'KEY MATERIAL',
    },
    {
      name: 'a source with a network call',
      candidate: () => mutated(() => undefined, `${SOURCE_TEXT}\nvoid fetch('/x');`),
      expected: 'FORBIDDEN API',
    },
    {
      name: 'an amount at 2^40',
      candidate: () => mutated((p) => setSlot(p, 0, { amountCents: AMOUNT_BOUND_CENTS })),
      expected: 'AMOUNT ABOVE 2^40',
    },
    {
      name: 'an unfrozen constant',
      candidate: () => ({ ...genuine(), frozen: false }),
      expected: 'NOT FROZEN',
    },
  ];

  it.each(cases)('rejects $name', ({ candidate, expected }) => {
    expect(validate(candidate())).toContain(expected);
  });

  it('rejects slot 0 when one more cent would pass the limit', () => {
    const c = { ...genuine(), limitCents: 150000n };
    expect(validate(c)).toContain('SLOT 0 PLUS ONE CENT OVER LIMIT');
  });
});

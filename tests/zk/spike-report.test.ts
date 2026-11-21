import { describe, expect, it } from 'vitest';
import { AMOUNT_BOUND_CENTS } from '../../src/ledger/field';
import { FLAG_NO, FLAG_YES, SIDE_CREDIT, SIDE_DEBIT } from '../../src/ledger/posting';
import type { Posting } from '../../src/ledger/posting';
import {
  collectTexts,
  containsWholeToken,
  describeError,
  findLeakedFields,
  modifyFirstSlotByOneCent,
} from '../../src/zk/spike-report';
import { SPIKE_WITNESS } from '../../src/zk/spike-witness';
import type { SpikeWitness } from '../../src/zk/spike-witness';

// Requirements 9.1, 9.2, 9.4. Example test. Synthetic values only, nothing is printed.
const OUT_OF_RANGE = 'SPIKE SLOT 0 PLUS ONE CENT OUT OF RANGE';

function withSlot0(amountCents: bigint, reviewFlag: Posting['reviewFlag']): SpikeWitness {
  const first = SPIKE_WITNESS.postings[0] as Posting;
  const rest = SPIKE_WITNESS.postings.slice(1);
  return { ...SPIKE_WITNESS, postings: [{ ...first, amountCents, reviewFlag }, ...rest] };
}

function balance(postings: readonly Posting[]): bigint {
  let net = 0n;
  for (const p of postings) net += p.side === SIDE_DEBIT ? p.amountCents : -p.amountCents;
  return net;
}

describe('modifyFirstSlotByOneCent (9.1)', () => {
  it('adds one cent to slot 0 and keeps the other slots as the same objects', () => {
    const copy = modifyFirstSlotByOneCent(SPIKE_WITNESS);
    const original = SPIKE_WITNESS.postings[0] as Posting;
    expect((copy.postings[0] as Posting).amountCents).toBe(original.amountCents + 1n);
    expect(copy.postings).toHaveLength(SPIKE_WITNESS.postings.length);
    for (let i = 1; i < copy.postings.length; i += 1) {
      expect(copy.postings[i]).toBe(SPIKE_WITNESS.postings[i]);
    }
    expect(copy.limitCents).toBe(SPIKE_WITNESS.limitCents);
    expect(copy.recordCount).toBe(64);
  });

  it('does not change the original, and the original stays balanced', () => {
    const before = (SPIKE_WITNESS.postings[0] as Posting).amountCents;
    modifyFirstSlotByOneCent(SPIKE_WITNESS);
    expect((SPIKE_WITNESS.postings[0] as Posting).amountCents).toBe(before);
    expect(balance(SPIKE_WITNESS.postings)).toBe(0n);
    expect(Object.isFrozen(SPIKE_WITNESS)).toBe(true);
  });

  it('returns a frozen copy that is unbalanced by exactly one cent, debits over credits', () => {
    const copy = modifyFirstSlotByOneCent(SPIKE_WITNESS);
    expect(Object.isFrozen(copy)).toBe(true);
    expect(Object.isFrozen(copy.postings)).toBe(true);
    expect(balance(copy.postings)).toBe(1n);
    expect((copy.postings[0] as Posting).side).toBe(SIDE_DEBIT);
    expect((copy.postings[1] as Posting).side).toBe(SIDE_CREDIT);
  });

  it('keeps the modified amount below 2^40 and at or below the limit', () => {
    const copy = modifyFirstSlotByOneCent(SPIKE_WITNESS);
    const amount = (copy.postings[0] as Posting).amountCents;
    expect(amount < AMOUNT_BOUND_CENTS).toBe(true);
    expect(amount <= copy.limitCents).toBe(true);
  });

  it('throws a fixed message when the new amount would reach 2^40', () => {
    const edge = withSlot0(AMOUNT_BOUND_CENTS - 1n, FLAG_YES);
    expect(() => modifyFirstSlotByOneCent(edge)).toThrow(OUT_OF_RANGE);
  });

  it('throws when the new amount passes the limit and slot 0 has no review flag', () => {
    const atLimit = withSlot0(SPIKE_WITNESS.limitCents, FLAG_NO);
    expect(() => modifyFirstSlotByOneCent(atLimit)).toThrow(OUT_OF_RANGE);
  });

  it('allows an amount above the limit when slot 0 is flagged', () => {
    const flagged = withSlot0(SPIKE_WITNESS.limitCents, FLAG_YES);
    const copy = modifyFirstSlotByOneCent(flagged);
    expect((copy.postings[0] as Posting).amountCents).toBe(SPIKE_WITNESS.limitCents + 1n);
  });

  it('throws on a witness without postings', () => {
    const empty = { ...SPIKE_WITNESS, postings: [] };
    expect(() => modifyFirstSlotByOneCent(empty)).toThrow(OUT_OF_RANGE);
  });
});

describe('describeError (9.2)', () => {
  it('describes an Error: constructor, own property names and message', () => {
    const shape = describeError(new Error('FIXED TEXT'));
    expect(shape.typeofThrown).toBe('object');
    expect(shape.ctorName).toBe('Error');
    expect(shape.ownPropertyNames).toContain('message');
    expect(shape.ownPropertyNames).toContain('stack');
    expect(shape.message).toBe('FIXED TEXT');
  });

  it('describes a thrown string, number and null without an object shape', () => {
    const none = { ctorName: null, ownPropertyNames: null, message: null };
    expect(describeError('boom')).toEqual({ typeofThrown: 'string', ...none });
    expect(describeError(42)).toEqual({ typeofThrown: 'number', ...none });
    expect(describeError(null)).toEqual({ typeofThrown: 'object', ...none });
  });

  it('lists non-enumerable own properties', () => {
    const thrown = { visible: 1 };
    Object.defineProperty(thrown, 'hidden', { value: 2, enumerable: false });
    const shape = describeError(thrown);
    expect(shape.ownPropertyNames).toEqual(['visible', 'hidden']);
    expect(shape.ctorName).toBe('Object');
    expect(shape.message).toBeNull();
  });

  it('gives a null constructor name for an object without a prototype', () => {
    const shape = describeError(Object.create(null));
    expect(shape.typeofThrown).toBe('object');
    expect(shape.ctorName).toBeNull();
    expect(shape.ownPropertyNames).toEqual([]);
  });

  it('never throws on a hostile getter or a revoked proxy', () => {
    const hostile = {
      get message(): string {
        throw new Error('GETTER');
      },
    };
    expect(describeError(hostile).message).toBeNull();
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    const shape = describeError(proxy);
    expect(shape.typeofThrown).toBe('object');
    expect(shape.ctorName).toBeNull();
    expect(shape.ownPropertyNames).toBeNull();
    expect(shape.message).toBeNull();
  });
});

describe('containsWholeToken (9.4)', () => {
  it('rejects a match inside a longer digit run or next to a letter', () => {
    expect(containsWholeToken('value 1234567 here', '234567')).toBe(false);
    expect(containsWholeToken('value 1234567 here', '123456')).toBe(false);
    expect(containsWholeToken('a123', '123')).toBe(false);
    expect(containsWholeToken('123b', '123')).toBe(false);
    expect(containsWholeToken('value 1234567 here', '1234567')).toBe(true);
  });

  it('treats underscore, colon, space, start and end as delimiters', () => {
    expect(containsWholeToken('x_123_y', '123')).toBe(true);
    expect(containsWholeToken('a:123:b', '123')).toBe(true);
    expect(containsWholeToken('a 123 b', '123')).toBe(true);
    expect(containsWholeToken('123 b', '123')).toBe(true);
    expect(containsWholeToken('a 123', '123')).toBe(true);
    expect(containsWholeToken('123', '123')).toBe(true);
  });

  it('matches the 0x lowercase hexadecimal form case-insensitively', () => {
    expect(containsWholeToken('salt 0xAbCdEf end', '0xabcdef')).toBe(true);
    expect(containsWholeToken('salt 0xabcdef0 end', '0xabcdef')).toBe(false);
  });

  it('tries every occurrence, ignores an empty token and does not read a pattern', () => {
    expect(containsWholeToken('1234 12', '12')).toBe(true);
    expect(containsWholeToken('anything', '')).toBe(false);
    expect(containsWholeToken('cost 1.5 now', '1.5')).toBe(true);
    expect(containsWholeToken('cost 105 now', '1.5')).toBe(false);
  });
});

describe('collectTexts', () => {
  it('collects the message, own strings, strings in arrays and JSON of objects', () => {
    const error = Object.assign(new Error('MSG'), {
      callStack: ['4004'],
      rawAssertionPayload: { selector: '1', data: [] },
    });
    const texts = collectTexts(error);
    expect(texts).toContain('MSG');
    expect(texts).toContain('4004');
    expect(texts).toContain('{"selector":"1","data":[]}');
  });

  it('handles a thrown string, null and a cyclic object without throwing', () => {
    expect(collectTexts('boom')).toEqual(['boom']);
    expect(collectTexts(null)).toEqual([]);
    const cyclic: Record<string, unknown> = { note: 'N' };
    cyclic['self'] = cyclic;
    expect(collectTexts(cyclic)).toEqual(['N']);
  });
});

const P: Posting = {
  recordId: 424242n,
  account: 777000111n,
  side: SIDE_DEBIT,
  amountCents: 31337n,
  reviewFlag: FLAG_NO,
  salt: 99887766n,
};

describe('findLeakedFields (9.4)', () => {
  it('returns an empty list when no value appears', () => {
    expect(findLeakedFields([], [P])).toEqual([]);
    expect(findLeakedFields(['DEBITS NOT EQUAL TO CREDITS'], [P])).toEqual([]);
  });

  it('names a field whose value appears as a whole decimal token', () => {
    expect(findLeakedFields(['value 31337 here'], [P])).toEqual(['AMOUNT']);
    expect(findLeakedFields(['id=424242'], [P])).toEqual(['RECORD ID']);
    expect(findLeakedFields(['9931337'], [P])).toEqual([]);
  });

  it('finds hexadecimal spellings, including the 64-digit field form', () => {
    const hex = P.salt.toString(16);
    expect(findLeakedFields([`0x${hex}`], [P])).toEqual(['SALT']);
    expect(findLeakedFields([`0x${hex.padStart(64, '0')}`], [P])).toEqual(['SALT']);
    expect(findLeakedFields([`0x00${hex}`], [P])).toEqual([]);
  });

  it('returns each name once, in the order AMOUNT, SALT, ACCOUNT, RECORD ID', () => {
    const texts = ['id 424242', 'account 777000111', 'salt 99887766 again 99887766', 'a 31337'];
    expect(findLeakedFields(texts, [P, P])).toEqual(['AMOUNT', 'SALT', 'ACCOUNT', 'RECORD ID']);
  });

  it('skips a value of zero', () => {
    const zero: Posting = { ...P, amountCents: 0n, recordId: 0n };
    expect(findLeakedFields(['0', 'x 0 y'], [zero])).toEqual([]);
  });
});

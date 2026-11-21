import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseBatch } from '../../src/ledger/parse';
import { serializeBatch } from '../../src/ledger/serialize';
import { runProperty } from '../support/pbt';
import {
  LITERAL_LINE_WIDTH,
  LITERAL_SUMS,
  at,
  validTextArb,
} from '../support/ledger-arbitraries';

// Feature: ledger-format, Property text_roundtrip: For all valid Batch_File text t built field by field from the column layout, serializeBatch(parseBatch(t)) equals t
// **Validates: Requirements 2.3**
//
// Seed 20262002, 500 runs. The text `t` comes from `validTextArb`, which joins zero-padded
// column texts with the widths of design.md "Column layout". It does not call `serializeBatch`,
// so this property can tell a serializer that agrees with the parser from one that agrees with
// the layout. Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262002;
const NUM_RUNS = 500;

describe('text_roundtrip', () => {
  it('text_roundtrip: the literal column widths of every record type sum to 131', () => {
    expect(LITERAL_LINE_WIDTH).toBe(131);
    expect(LITERAL_SUMS.header).toBe(131); // 1 + 16 + 114
    expect(LITERAL_SUMS.posting).toBe(131); // 1 + 20 + 20 + 1 + 13 + 1 + 75
    expect(LITERAL_SUMS.trailer).toBe(131); // 1 + 16 + 2 + 112
  });

  it('text_roundtrip: serializeBatch(parseBatch(t)) equals t for all valid texts', () => {
    runProperty(
      'ledger-format text_roundtrip',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(validTextArb, ({ text, batch }) => {
        // The fixture really is 131-character lines with a final LF.
        expect(text.endsWith('\n')).toBe(true);
        const lines = text.slice(0, -1).split('\n');
        expect(lines.length).toBe(batch.postings.length + 2);
        for (const line of lines) {
          expect(line.length).toBe(LITERAL_LINE_WIDTH);
        }
        expect(at(lines, 0).charAt(0)).toBe('H');
        expect(at(lines, lines.length - 1).charAt(0)).toBe('T');

        const parsed = parseBatch(text);
        expect(parsed.postings.length).toBe(batch.postings.length);
        expect(serializeBatch(parsed)).toBe(text);
      }),
    );
  });
});

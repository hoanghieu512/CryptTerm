import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Batch } from '../../src/ledger/batch';
import { parseBatch } from '../../src/ledger/parse';
import { serializeBatch } from '../../src/ledger/serialize';
import { runProperty } from '../support/pbt';
import {
  LITERAL_LINE_WIDTH,
  at,
  batchArb,
  batchText,
  headerLine,
  postingLine,
  trailerLine,
} from '../support/ledger-arbitraries';

// Feature: ledger-format, Property roundtrip: For all valid Batch b, parseBatch(serializeBatch(b)) deep-equals b
// **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
//
// Seed 20262001, 500 runs. The serialized text is also compared with the text that
// `tests/support/ledger-arbitraries.ts` builds field by field from the column layout, so a wrong
// column or width in `serializeBatch` fails here and is not hidden by a matching wrong parser.
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262001;
const NUM_RUNS = 500;

describe('roundtrip', () => {
  it('roundtrip: parseBatch(serializeBatch(b)) deep-equals b for all valid batches', () => {
    runProperty(
      'ledger-format roundtrip',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(batchArb, (batch) => {
        const text = serializeBatch(batch);

        // Shape of the text: LF-terminated lines of 131 characters, header, postings, trailer.
        expect(text.endsWith('\n')).toBe(true);
        const lines = text.slice(0, -1).split('\n');
        expect(lines.length).toBe(batch.postings.length + 2);
        for (const line of lines) {
          expect(line.length).toBe(LITERAL_LINE_WIDTH);
        }
        expect(text).toBe(batchText(batch));

        // The round trip itself.
        const parsed = parseBatch(text);
        expect(parsed).toStrictEqual(batch);
      }),
    );
  });

  it('roundtrip: letters D, C, N, Y map to 0n, 1n, 0n, 1n and the lines match the layout', () => {
    // Requirement 1.2. One posting per side/flag pair, columns checked at literal offsets.
    const base = {
      recordId: 100000n,
      account: 123456789012n,
      amountCents: 250000n,
      salt: 987654321n,
    };
    const batch: Batch = {
      batchId: 'CTB-20261201-001',
      postings: [
        { ...base, side: 0n, reviewFlag: 0n },
        { ...base, side: 1n, reviewFlag: 1n },
        { ...base, side: 0n, reviewFlag: 1n },
        { ...base, side: 1n, reviewFlag: 0n },
      ],
    };
    const text = serializeBatch(batch);
    const lines = text.slice(0, -1).split('\n');
    expect(lines[0]).toBe(headerLine('CTB-20261201-001'));
    expect(lines[5]).toBe(trailerLine('CTB-20261201-001', 4));
    const letters = [
      ['D', 'N'],
      ['C', 'Y'],
      ['D', 'Y'],
      ['C', 'N'],
    ];
    letters.forEach(([side, flag], i) => {
      const line = at(lines, i + 1);
      expect(line.charAt(41)).toBe(side); // column 42
      expect(line.charAt(55)).toBe(flag); // column 56
      expect(line.slice(42, 55)).toBe('0000000250000'); // columns 43 to 55
      expect(line).toBe(postingLine(at(batch.postings, i)));
    });
    expect(parseBatch(text)).toStrictEqual(batch);
  });
});

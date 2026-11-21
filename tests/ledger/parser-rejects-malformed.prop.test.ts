import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseBatch } from '../../src/ledger/parse';
import { runProperty } from '../support/pbt';
import { captureThrown, expectFormatError } from '../support/ledger-asserts';
import {
  DEFECT_CLASSES,
  DEFECT_CODES,
  batchText,
  batchArb,
  defectCaseArb,
  defectCaseArbFor,
} from '../support/ledger-arbitraries';

// Feature: ledger-format, Property parser_rejects_malformed: For all valid texts with one injected defect, parseBatch throws a BatchFormatError with the defect's line and code and no field value
// **Validates: Requirements 1.3, 1.4, 1.5, 3.1**
//
// Seed 20262003, 300 runs. Defect classes (design.md "Parse order" code table):
//   wrong line width        LINE_WIDTH         amount with a non-digit    AMOUNT_NOT_DIGITS
//   amount >= 2^40          AMOUNT_RANGE       trailer count mismatch     COUNT_MISMATCH
//   trailer batch id differs BATCH_ID_MISMATCH side not D or C            SIDE_INVALID
//   flag not Y or N         FLAG_INVALID       more than 64 postings      TOO_MANY_POSTINGS (line 66)
//   zero postings           ZERO_POSTINGS (2)  missing header             MISSING_HEADER (1)
//   missing trailer         MISSING_TRAILER    CRLF line ends             CR_IN_LINE
// Each case plants a distinctive digit string (918273645) or a full-width digit column in the
// rejected line. The error message must equal `BATCH FORMAT ERROR LINE <n> <CODE>`, and no
// message, stack or own property may contain the planted values or the rejected line's columns.
// Data is synthetic. Nothing is printed except the seed line from `runProperty`.

const SEED = 20262003;
const NUM_RUNS = 300;

describe('parser_rejects_malformed', () => {
  it('parser_rejects_malformed: one defect gives the expected line and code and leaks no field value', () => {
    runProperty(
      'ledger-format parser_rejects_malformed',
      { seed: SEED, numRuns: NUM_RUNS },
      fc.property(defectCaseArb, (c) => {
        expect(c.code).toBe(DEFECT_CODES[c.defect]);
        const thrown = captureThrown(() => parseBatch(c.text));
        expectFormatError(thrown, { line: c.line, code: c.code, secrets: c.secrets });
      }),
    );
  });

  it('parser_rejects_malformed: the twelve defect classes give twelve different codes', () => {
    // Every class is exercised, so the property above cannot pass by drawing only some classes.
    const seen = new Map<string, string>();
    for (const defect of DEFECT_CLASSES) {
      const cases = fc.sample(defectCaseArbFor(defect), { seed: SEED, numRuns: 20 });
      expect(cases.length).toBe(20);
      for (const c of cases) {
        const thrown = captureThrown(() => parseBatch(c.text));
        expectFormatError(thrown, { line: c.line, code: c.code, secrets: c.secrets });
      }
      seen.set(DEFECT_CODES[defect], defect);
    }
    expect(DEFECT_CLASSES.length).toBe(12);
    expect(seen.size).toBe(12);
  });

  it('parser_rejects_malformed: a valid batch text is accepted (negative control)', () => {
    // Without this, a parser that throws on everything would satisfy the properties above.
    for (const batch of fc.sample(batchArb, { seed: SEED, numRuns: 20 })) {
      expect(parseBatch(batchText(batch))).toStrictEqual(batch);
    }
  });

  it('parser_rejects_malformed: empty text and text without a final LF are rejected', () => {
    // Design "Parse order" step 1. Not one of the twelve classes, kept as plain examples.
    expectFormatError(
      captureThrown(() => parseBatch('')),
      { line: 1, code: 'MISSING_HEADER', secrets: [] },
    );
    const [batch] = fc.sample(batchArb, { seed: SEED, numRuns: 1 });
    if (batch === undefined) throw new Error('NO BATCH SAMPLED');
    const noFinalLf = batchText(batch).slice(0, -1);
    const lastLine = batch.postings.length + 2;
    expectFormatError(
      captureThrown(() => parseBatch(noFinalLf)),
      { line: lastLine, code: 'NO_FINAL_LF', secrets: [batch.batchId] },
    );
  });
});

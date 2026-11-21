import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Requirements 13.3, 13.4, 13.7, 13.8. Example test of the shape of docs/spike-results.md.
// huynh fills the measured cells (huynh's own numbers, transcribed). This test checks the
// structure, and that a filled cell holds a plain value: no estimate, range or placeholder.
const DOC = fileURLToPath(new URL('../../docs/spike-results.md', import.meta.url));
const text = readFileSync(DOC, 'utf8');
const lines = text.split('\n');

const HEADINGS = [
  'Header',
  'Gate table',
  'Cold_Run procedure',
  'Tests written first',
  'Lookups',
  'Invalid-witness report',
  'Spike-only files',
  'Browser steps for huynh',
];

function section(name: string): string[] {
  const start = lines.findIndex((l) => l === `## ${name}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

function cells(row: string): string[] {
  return row.split('|').slice(1, -1).map((c) => c.trim());
}

function gateRows(): string[][] {
  return section('Gate table').filter((l) => l.startsWith('|')).map(cells);
}

describe('results document structure', () => {
  it('has the eight required headings in order', () => {
    const found = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
    const positions = HEADINGS.map((h) => found.indexOf(h));
    for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('lists the six Cold_Run steps in order', () => {
    const steps = section('Cold_Run procedure').filter((l) => /^\d+\. /.test(l));
    expect(steps.map((l) => l.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.']);
    expect(steps[1]).toContain('Disable cache');
    expect(steps[2]).toContain('4x slowdown');
    expect(steps[3]).toContain('first time');
  });
});

const COLUMNS = [
  'Target', 'Cold_Run total (ms)', 'WASM INIT (ms)', 'WITNESS PREP (ms)', 'EXECUTE (ms)',
  'PROVE (ms)', 'VERIFY (ms)', 'Proof size (bytes)', 'Chrome version', 'Machine', 'Pass or fail',
];

describe('gate table', () => {
  const rows = gateRows();
  const data = rows.slice(2);

  it('has the eleven columns and exactly two data rows with the two targets', () => {
    expect(rows[0]).toEqual(COLUMNS);
    expect(data).toHaveLength(2);
    expect(data[0]?.[0]).toMatch(/^Normal_Gate: under 30 s$/);
    expect(data[1]?.[0]).toBe(
      'Throttled_Gate: under 60 s with Chrome DevTools 4x CPU throttling',
    );
    for (const row of data) expect(row).toHaveLength(11);
  });

  it('holds a plain whole number or nothing in each of the seven measured cells', () => {
    for (const row of data) {
      for (const cell of row.slice(1, 8)) expect(cell).toMatch(/^(\d+)?$/);
    }
  });

  it('holds nothing, PASS, FAIL or NOT MEASURED in the pass or fail cell', () => {
    for (const row of data) expect(row[10]).toMatch(/^(|PASS|FAIL|NOT MEASURED.*)$/);
  });

  it('keeps PASS and FAIL consistent with a strict comparison to the target', () => {
    const targets = [30000, 60000];
    data.forEach((row, i) => {
      const total = row[1] ?? '';
      const mark = row[10] ?? '';
      if (mark === 'PASS' || mark === 'FAIL') expect(total).toMatch(/^\d+$/);
      if (mark === 'PASS') expect(Number(total)).toBeLessThan(targets[i] ?? 0);
      if (mark === 'FAIL') expect(Number(total)).toBeGreaterThanOrEqual(targets[i] ?? 0);
    });
  });
});

const REPORT_LABELS = [
  'EXECUTE THREW', 'RETURNED WITNESS', 'ERROR CONSTRUCTOR', 'ERROR PROPERTIES', 'ERROR MESSAGE',
  'PRIVATE VALUE IN ERROR', 'PROOF ATTEMPT THREW', 'PROOF ERROR CONSTRUCTOR',
  'PROOF ERROR PROPERTIES', 'PROOF ERROR MESSAGE', 'PROOF VERIFIED',
];

describe('browser steps and invalid-witness report', () => {
  it('lists eight numbered browser steps in order', () => {
    const steps = section('Browser steps for huynh').filter((l) => /^\d+\. /.test(l));
    expect(steps.map((l) => l.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.']);
    expect(steps[7]).toContain('verify-srs');
  });

  it('has the browser fill-in list and keeps the Node pre-check under its own heading', () => {
    const body = section('Invalid-witness report');
    expect(body).toContain('### Node pre-check (task 6.7)');
    for (const label of REPORT_LABELS) {
      expect(body.some((l) => l.startsWith(`- \`${label}\`:`))).toBe(true);
    }
  });
});

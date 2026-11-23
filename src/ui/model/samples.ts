// The four built-in samples, in menu order (terminal-ui design, "Data Models"). This table is the
// only source of sample names and of the file names the loader requests.
interface SampleEntryShape {
  readonly no: string;
  readonly name: string;
  readonly label: string;
  readonly note: string;
}

export const SAMPLES = [
  { no: '1', name: 'clean', label: 'CLEAN', note: 'BALANCED, WITHIN LIMIT' },
  { no: '2', name: 'over-limit-unflagged', label: 'OVER-LIMIT UNFLAGGED', note: 'ONE POSTING OVER LIMIT, NO REVIEW FLAG' },
  { no: '3', name: 'unbalanced', label: 'UNBALANCED', note: 'DEBITS DO NOT EQUAL CREDITS' },
  { no: '4', name: 'large', label: 'LARGE', note: '64 POSTINGS, 6 PAGES' },
] as const satisfies readonly SampleEntryShape[];

export type SampleEntry = (typeof SAMPLES)[number];
export type SampleName = SampleEntry['name'];

/** Exact string match against `no`: `'1 '`, `'01'` and `'__proto__'` are not samples. */
export function sampleByNumber(text: string): SampleEntry | null {
  if (typeof text !== 'string') return null;
  return SAMPLES.find((s) => s.no === text) ?? null;
}

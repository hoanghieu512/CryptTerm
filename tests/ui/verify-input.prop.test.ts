import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_INPUT_CHARS } from '../../src/zk/bundle';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import type { DroppedFile, TerminalState } from '../../src/ui/model/types';
import { update } from '../../src/ui/model/update';
import { TerminalView } from '../../src/ui/terminal-view';
import { runProperty } from '../support/pbt';
import { TINY_BATCH, stateOn, step } from '../support/terminal-arbitraries';

// Group 1 tests of the verifier spec for the bundle input paths: paste, drop, the file read that a
// drop starts, and the rule that the bundle text is held once and never drawn. They run on the pure
// model. The size limit is the one exported by `src/zk/bundle.ts`, imported here, never retyped.

/** A dropped file that records every `text()` call. The model must never call it. */
interface FakeFile extends DroppedFile {
  readonly textCalls: () => number;
}

function fakeFile(name: string, size: number): FakeFile {
  let calls = 0;
  return {
    name,
    size,
    text: async (): Promise<string> => {
      calls += 1;
      return '';
    },
    textCalls: () => calls,
  };
}

const onVerify = (): TerminalState => stateOn('CTM900', TINY_BATCH);

/** The four fields that a refused paste or drop must leave alone. */
function heldBy(state: TerminalState): Pick<TerminalState['verify'], 'bundleText' | 'source' | 'bundleSeq' | 'pendingRead'> {
  const { bundleText, source, bundleSeq, pendingRead } = state.verify;
  return { bundleText, source, bundleSeq, pendingRead };
}

describe('verify_paste_and_drop: the size limit', () => {
  it('verify_paste_and_drop: MAX_INPUT_CHARS is the 1,048,576 of the requirements', () => {
    expect(MAX_INPUT_CHARS).toBe(1_048_576);
  });
});

// ---------------------------------------------------------------------------------------------
// Property 7: paste and drop acceptance rules
// ---------------------------------------------------------------------------------------------

const pasteTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.constant(''),
  fc.string({ unit: 'binary', maxLength: 20 }),
);

describe('verify_paste_and_drop: paste', () => {
  // Feature: verifier, Property 7: Paste and drop acceptance rules (paste)
  // **Validates: Requirements 3.3**
  it('verify_paste_and_drop: a non-empty text replaces the bundle with source PASTE, an empty text changes nothing', () => {
    runProperty('verify_paste_and_drop paste', { seed: 20264907, numRuns: 200 }, fc.property(pasteTextArb, fc.boolean(), (text, hasOlder) => {
      const before = hasOlder ? step(onVerify(), { type: 'PASTE_TEXT', text: 'older' }) : onVerify();
      const result = update(before, { type: 'PASTE_TEXT', text });
      expect(result.effects).toEqual([]);
      if (text.length > 0) {
        expect(result.state.verify.bundleText).toBe(text);
        expect(result.state.verify.source).toBe('PASTE');
        expect(result.state.verify.bundleSeq).toBe(before.verify.bundleSeq + 1);
        expect(result.state.verify.pendingRead).toBeNull();
        expect(result.state.status).toBe(MESSAGES.BUNDLE_READY);
      } else {
        expect(result.state).toEqual(before);
      }
    }));
  });

  it('verify_paste_and_drop: a value that is not a string is ignored', () => {
    const before = onVerify();
    for (const value of [null, undefined, 42, {}, ['a'], true]) {
      const result = update(before, { type: 'PASTE_TEXT', text: value as unknown as string });
      expect(result.state).toEqual(before);
      expect(result.effects).toEqual([]);
    }
  });

  it('verify_paste_and_drop: a paste off CTM900 is ignored', () => {
    const before = stateOn('CTM000', TINY_BATCH);
    const result = update(before, { type: 'PASTE_TEXT', text: 'abc' });
    expect(result.state).toEqual(before);
    expect(result.effects).toEqual([]);
  });

  it('verify_paste_and_drop: a paste clears a pending file read, so an older read is dropped', () => {
    const dropped = step(onVerify(), { type: 'FILES_DROPPED', files: [fakeFile('a.json', 10)] });
    const readId = dropped.verify.pendingRead;
    expect(readId).not.toBeNull();
    const pasted = step(dropped, { type: 'PASTE_TEXT', text: 'newer' });
    expect(pasted.verify.pendingRead).toBeNull();
    const late = update(pasted, { type: 'FILE_READ', readId: readId ?? -1, text: 'older' });
    expect(late.state).toBe(pasted);
    expect(late.state.verify.bundleText).toBe('newer');
  });
});

const sizeArb: fc.Arbitrary<number> = fc
  .oneof(
    fc.constantFrom(
      0,
      1,
      MAX_INPUT_CHARS - 1,
      MAX_INPUT_CHARS,
      MAX_INPUT_CHARS + 1,
      2 ** 53,
      2 ** 53 - 1,
      2 ** 53 + 2,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      1.5,
    ),
    fc.integer({ min: 0, max: 2 * MAX_INPUT_CHARS }),
    fc.double(),
  )
  .filter((n) => !Object.is(n, -0));

const nameArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 10 }),
  fc.tuple(fc.string({ maxLength: 10 }), fc.constantFrom('.json', '.JSON', '.Json', '.jSoN')).map(([a, b]) => `${a}${b}`),
  fc.tuple(fc.string({ maxLength: 10 }), fc.constantFrom('.jsonx', '.json ', '.jso', 'json', '.txt', '.json.bak')).map(([a, b]) => `${a}${b}`),
  fc.constantFrom('', '.json', 'a.json', 'BUNDLE.JSON'),
);

interface FileSpec {
  readonly name: string;
  readonly size: number;
}

const fileSpecArb: fc.Arbitrary<FileSpec> = fc.record({ name: nameArb, size: sizeArb });

// Mostly one file, since that is the case with a size rule. Sometimes none, two or three.
const dropArb: fc.Arbitrary<FileSpec[]> = fc.oneof(
  { weight: 4, arbitrary: fileSpecArb.map((f) => [f]) },
  { weight: 1, arbitrary: fc.array(fileSpecArb, { maxLength: 3 }) },
);

type Prior = 'fresh' | 'pasted' | 'pending';

/** A CTM900 state with nothing held, with a pasted bundle, or with a file read in flight. */
function priorState(kind: Prior): TerminalState {
  const base = onVerify();
  if (kind === 'fresh') return base;
  if (kind === 'pasted') return step(base, { type: 'PASTE_TEXT', text: 'prior bundle text' });
  return step(base, { type: 'FILES_DROPPED', files: [fakeFile('prior.json', 10)] });
}

function isJsonName(name: string): boolean {
  return name.toLowerCase().endsWith('.json');
}

function isAcceptedSize(size: number): boolean {
  return Number.isSafeInteger(size) && size >= 0 && size <= MAX_INPUT_CHARS;
}

describe('verify_paste_and_drop: drop', () => {
  // Feature: verifier, Property 7: Paste and drop acceptance rules (drop)
  // **Validates: Requirements 3.4, 3.5**
  it('verify_paste_and_drop: one READ_FILE for exactly one .json file of an accepted size, otherwise only the status changes', () => {
    runProperty(
      'verify_paste_and_drop drop',
      { seed: 20264907, numRuns: 200 },
      fc.property(dropArb, fc.constantFrom<Prior>('fresh', 'pasted', 'pending'), (specs, prior) => {
        const files = specs.map((s) => fakeFile(s.name, s.size));
        const before = priorState(prior);
        const result = update(before, { type: 'FILES_DROPPED', files });

        const only = specs.length === 1 ? specs[0] : undefined;
        const nameOk = only !== undefined && isJsonName(only.name);
        const accepted = only !== undefined && nameOk && isAcceptedSize(only.size);

        // The model never reads the content of a file. The host does, after READ_FILE.
        for (const f of files) expect(f.textCalls()).toBe(0);

        if (accepted) {
          expect(result.effects).toHaveLength(1);
          const effect = result.effects[0];
          expect(effect?.type).toBe('READ_FILE');
          if (effect?.type === 'READ_FILE') {
            expect(effect.readId).toBe(before.nextLoadId);
            expect(effect.file).toBe(files[0]);
          }
          expect(result.state.verify.pendingRead).toBe(before.nextLoadId);
          expect(result.state.nextLoadId).toBe(before.nextLoadId + 1);
          // The text and source change only when the read settles.
          expect(result.state.verify.bundleText).toBe(before.verify.bundleText);
          expect(result.state.verify.source).toBe(before.verify.source);
          expect(result.state.verify.bundleSeq).toBe(before.verify.bundleSeq);
        } else {
          expect(result.effects).toEqual([]);
          expect(heldBy(result.state)).toEqual(heldBy(before));
          expect(result.state.nextLoadId).toBe(before.nextLoadId);
          expect(result.state.status).toBe(nameOk ? MESSAGES.FILE_TOO_LARGE : MESSAGES.DROP_ONE_JSON);
        }
      }),
    );
  });

  // The boundary values, taken from the imported limit. 1,048,576 is read, 1,048,577 is refused.
  it.each([
    [0, true],
    [1, true],
    [MAX_INPUT_CHARS - 1, true],
    [MAX_INPUT_CHARS, true],
    [MAX_INPUT_CHARS + 1, false],
    [2 ** 53, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [-1, false],
    [1.5, false],
  ] as const)('verify_paste_and_drop: a .json file of size %s is read: %s', (size, read) => {
    const before = priorState('pasted');
    const file = fakeFile('bundle.json', size);
    const result = update(before, { type: 'FILES_DROPPED', files: [file] });
    expect(file.textCalls()).toBe(0);
    if (read) {
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.type).toBe('READ_FILE');
      expect(result.state.verify.pendingRead).not.toBeNull();
    } else {
      expect(result.effects).toEqual([]);
      expect(result.state.status).toBe(MESSAGES.FILE_TOO_LARGE);
      expect(heldBy(result.state)).toEqual(heldBy(before));
    }
  });

  it('verify_paste_and_drop: a file of MAX_INPUT_CHARS + 1 bytes keeps bundleText, source, bundleSeq and a pending read', () => {
    const before = priorState('pending');
    const pending = before.verify.pendingRead;
    expect(pending).not.toBeNull();
    const file = fakeFile('big.json', MAX_INPUT_CHARS + 1);
    const result = update(before, { type: 'FILES_DROPPED', files: [file] });
    expect(result.effects).toEqual([]);
    expect(file.textCalls()).toBe(0);
    expect(result.state.status).toBe('FILE TOO LARGE');
    expect(result.state.verify.pendingRead).toBe(pending);
    expect(result.state.verify.bundleText).toBe(before.verify.bundleText);
    expect(result.state.verify.source).toBe(before.verify.source);
    expect(result.state.verify.bundleSeq).toBe(before.verify.bundleSeq);
    // The older read that is still pending stays current.
    const settled = update(result.state, { type: 'FILE_READ', readId: pending ?? -1, text: 'from the older file' });
    expect(settled.state.verify.bundleText).toBe('from the older file');
    expect(settled.state.verify.source).toBe('FILE');
  });

  it.each([
    ['no file', [] as FileSpec[]],
    ['two files', [{ name: 'a.json', size: 5 }, { name: 'b.json', size: 5 }]],
    ['a name that is not .json', [{ name: 'bundle.txt', size: 5 }]],
  ])('verify_paste_and_drop: %s gives DROP ONE .JSON FILE and changes only the status', (_label, specs) => {
    const before = priorState('pasted');
    const files = specs.map((s) => fakeFile(s.name, s.size));
    const result = update(before, { type: 'FILES_DROPPED', files });
    expect(result.effects).toEqual([]);
    expect(result.state.status).toBe('DROP ONE .JSON FILE');
    expect(heldBy(result.state)).toEqual(heldBy(before));
    for (const f of files) expect(f.textCalls()).toBe(0);
  });

  it('verify_paste_and_drop: the .json check ignores letter case', () => {
    for (const name of ['a.JSON', 'A.Json', 'x.jSoN']) {
      const result = update(onVerify(), { type: 'FILES_DROPPED', files: [fakeFile(name, 10)] });
      expect(result.effects).toHaveLength(1);
    }
  });

  it('verify_paste_and_drop: a settled read replaces the bundle with source FILE, and a failed read keeps it', () => {
    const dropped = step(priorState('pasted'), { type: 'FILES_DROPPED', files: [fakeFile('a.json', 10)] });
    const readId = dropped.verify.pendingRead ?? -1;
    const failed = update(dropped, { type: 'FILE_READ_FAILED', readId });
    expect(failed.state.status).toBe(MESSAGES.FILE_READ_FAILED);
    expect(failed.state.verify.pendingRead).toBeNull();
    expect(failed.state.verify.bundleText).toBe('prior bundle text');
    expect(failed.state.verify.source).toBe('PASTE');

    const read = update(dropped, { type: 'FILE_READ', readId, text: 'file text' });
    expect(read.state.verify.bundleText).toBe('file text');
    expect(read.state.verify.source).toBe('FILE');
    expect(read.state.verify.pendingRead).toBeNull();
    expect(read.state.verify.bundleSeq).toBe(dropped.verify.bundleSeq + 1);
    expect(read.state.status).toBe(MESSAGES.BUNDLE_READY);
  });
});

// ---------------------------------------------------------------------------------------------
// Property 8, the read-order part: the newest source wins
// ---------------------------------------------------------------------------------------------

type Op =
  | { readonly kind: 'paste'; readonly text: string }
  | { readonly kind: 'drop' }
  | { readonly kind: 'drop-too-large' }
  | { readonly kind: 'read'; readonly pick: number; readonly bogus: boolean; readonly text: string }
  | { readonly kind: 'fail'; readonly pick: number; readonly bogus: boolean };

const nonEmptyTextArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 20 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: nonEmptyTextArb.map((text): Op => ({ kind: 'paste', text })) },
  { weight: 3, arbitrary: fc.constant<Op>({ kind: 'drop' }) },
  { weight: 1, arbitrary: fc.constant<Op>({ kind: 'drop-too-large' }) },
  {
    weight: 4,
    arbitrary: fc
      .tuple(fc.nat(), fc.boolean(), nonEmptyTextArb)
      .map(([pick, bogus, text]): Op => ({ kind: 'read', pick, bogus, text })),
  },
  { weight: 2, arbitrary: fc.tuple(fc.nat(), fc.boolean()).map(([pick, bogus]): Op => ({ kind: 'fail', pick, bogus })) },
);

/** Ids that no drop ever issues: the first id is 1 and each drop adds 1. */
const BOGUS_IDS: readonly number[] = [0, -1, 99_999];

describe('verify_single_run_and_stale_drop', () => {
  // Feature: verifier, Property 8: The newest source wins
  // **Validates: Requirements 3.6**
  it('verify_single_run_and_stale_drop (Property 8 part): the newest accepted paste or file read is held, and a stale settle is the same state object', () => {
    runProperty(
      'verify_single_run_and_stale_drop read order',
      { seed: 20264908, numRuns: 200 },
      fc.property(fc.array(opArb, { maxLength: 14 }), (ops) => {
        let state = onVerify();
        // The reference model: what is held, and which read id is pending. Written apart from the model.
        const ref = { text: '', source: 'NONE' as string, pending: null as number | null };
        const issued: number[] = [];

        for (const op of ops) {
          const prev = state;
          const idFor = (pick: number, bogus: boolean): number => {
            const real = issued.length === 0 ? undefined : issued[pick % issued.length];
            const fake = BOGUS_IDS[pick % BOGUS_IDS.length] ?? 0;
            return bogus || real === undefined ? fake : real;
          };

          if (op.kind === 'paste') {
            state = update(prev, { type: 'PASTE_TEXT', text: op.text }).state;
            ref.text = op.text;
            ref.source = 'PASTE';
            ref.pending = null;
          } else if (op.kind === 'drop') {
            const result = update(prev, { type: 'FILES_DROPPED', files: [fakeFile('a.json', 100)] });
            state = result.state;
            ref.pending = prev.nextLoadId;
            issued.push(prev.nextLoadId);
          } else if (op.kind === 'drop-too-large') {
            state = update(prev, { type: 'FILES_DROPPED', files: [fakeFile('a.json', MAX_INPUT_CHARS + 1)] }).state;
          } else if (op.kind === 'read') {
            const readId = idFor(op.pick, op.bogus);
            const result = update(prev, { type: 'FILE_READ', readId, text: op.text });
            state = result.state;
            if (readId === ref.pending) {
              ref.text = op.text;
              ref.source = 'FILE';
              ref.pending = null;
              expect(state.verify.bundleSeq).toBe(prev.verify.bundleSeq + 1);
            } else {
              expect(state).toBe(prev);
              expect(result.effects).toEqual([]);
            }
          } else {
            const readId = idFor(op.pick, op.bogus);
            const result = update(prev, { type: 'FILE_READ_FAILED', readId });
            state = result.state;
            if (readId === ref.pending) {
              ref.pending = null;
              expect(state.status).toBe(MESSAGES.FILE_READ_FAILED);
              expect(state.verify.bundleSeq).toBe(prev.verify.bundleSeq);
            } else {
              expect(state).toBe(prev);
              expect(result.effects).toEqual([]);
            }
          }

          expect(state.verify.bundleText).toBe(ref.text);
          expect(state.verify.source).toBe(ref.source);
          expect(state.verify.pendingRead).toBe(ref.pending);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Property 9: the bundle text is held once and never drawn
// ---------------------------------------------------------------------------------------------

// Lowercase letters and digits only. The screen text is uppercase, so no slice of this text can
// match a fixed label by chance. The sentinel is in the same alphabet and is planted in the middle.
const SENTINEL = 'sentinel-918273645-qz';
const BODY_UNITS: readonly string[] = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

const bodyArb = (maxLength: number): fc.Arbitrary<string> => fc.string({ unit: fc.constantFrom(...BODY_UNITS), maxLength });

const plantedTextArb: fc.Arbitrary<string> = fc
  .tuple(bodyArb(1500), bodyArb(1500))
  .map(([head, tail]) => `${head}${SENTINEL}${tail}`);

const SLICE = 20;

/** The 20-character slices of `text` that must not be drawn: the sentinel, the edges, and a stride. */
function slicesOf(text: string, stride: number): string[] {
  const starts = new Set<number>([0, Math.max(0, text.length - SLICE)]);
  const at = text.indexOf(SENTINEL);
  if (at >= 0) {
    starts.add(at);
    starts.add(Math.max(0, at - 10));
  }
  for (let i = 0; i + SLICE <= text.length; i += stride) starts.add(i);
  return [...starts].map((i) => text.slice(i, i + SLICE));
}

/** The first drawn slice found in any of the haystacks, or null. Reports a count, never the text. */
function drawnIn(text: string, haystacks: readonly string[], stride: number): string | null {
  for (const slice of slicesOf(text, stride)) {
    for (const hay of haystacks) if (hay.includes(slice)) return 'A SLICE OF THE BUNDLE TEXT IS DRAWN';
  }
  return null;
}

function markupOf(state: TerminalState): string {
  return renderToStaticMarkup(createElement(TerminalView, { state, onPf: () => undefined }));
}

/** Counts string values longer than 1,000 characters anywhere in a value. */
function longStrings(value: unknown, seen: Set<object> = new Set()): number {
  if (typeof value === 'string') return value.length > 1000 ? 1 : 0;
  if (typeof value !== 'object' || value === null || seen.has(value)) return 0;
  seen.add(value);
  let count = 0;
  if (value instanceof Map) {
    for (const [k, v] of value) count += longStrings(k, seen) + longStrings(v, seen);
    return count;
  }
  if (value instanceof Set) {
    for (const v of value) count += longStrings(v, seen);
    return count;
  }
  for (const v of Object.values(value)) count += longStrings(v, seen);
  return count;
}

type Feed = { readonly via: 'paste' | 'file'; readonly text: string };

const feedArb: fc.Arbitrary<Feed> = fc.tuple(fc.constantFrom<'paste' | 'file'>('paste', 'file'), plantedTextArb).map(([via, text]) => ({ via, text }));

/** A paste, or a drop followed by the settle of its read. Returns the state and the text it holds. */
function feed(state: TerminalState, f: Feed): TerminalState {
  if (f.via === 'paste') return step(state, { type: 'PASTE_TEXT', text: f.text });
  const dropped = step(state, { type: 'FILES_DROPPED', files: [fakeFile('bundle.json', f.text.length)] });
  const readId = dropped.verify.pendingRead;
  if (readId === null) throw new Error('FIXTURE: NO PENDING READ AFTER A DROP');
  return step(dropped, { type: 'FILE_READ', readId, text: f.text });
}

describe('verify_text_not_drawn', () => {
  // Feature: verifier, Property 9: The Bundle_Text is held once and never drawn
  // **Validates: Requirements 3.7**
  it('verify_text_not_drawn: no grid row, status text or DOM text holds the sentinel or a 20-character slice of the bundle text', () => {
    runProperty('verify_text_not_drawn', { seed: 20264909, numRuns: 200 }, fc.property(fc.array(feedArb, { minLength: 1, maxLength: 4 }), (feeds) => {
      let state = onVerify();
      for (const f of feeds) {
        state = feed(state, f);
        const rows = renderGrid(state);
        const grid = rows.join('\n');
        expect(grid).not.toContain(SENTINEL);
        expect(state.status).not.toContain(SENTINEL);
        expect(drawnIn(f.text, [grid], 97)).toBeNull();
      }
      const last = feeds[feeds.length - 1];
      if (last === undefined) throw new Error('FIXTURE: NO FEED');
      const markup = markupOf(state);
      expect(markup).not.toContain(SENTINEL);
      expect(drawnIn(last.text, [markup, renderGrid(state).join('\n')], 37)).toBeNull();
      // What is shown is the source name and the length.
      const grid = renderGrid(state).join('\n');
      expect(grid).toContain(`BUNDLE SOURCE  ${last.via === 'paste' ? 'PASTE' : 'FILE'}`);
      expect(grid).toContain(`BUNDLE LENGTH  ${last.text.length} CHARS`);
    }));
  });

  it('verify_text_not_drawn: a 5 MB paste with a sentinel is in no grid row, status text or DOM text', () => {
    const text = bigText();
    const state = step(onVerify(), { type: 'PASTE_TEXT', text });
    const grid = renderGrid(state).join('\n');
    const markup = markupOf(state);
    expect(text.length).toBeGreaterThanOrEqual(5 * 1024 * 1024);
    expect(grid).not.toContain(SENTINEL);
    expect(markup).not.toContain(SENTINEL);
    expect(state.status).not.toContain(SENTINEL);
    expect(drawnIn(text, [grid, markup], 1_000_003)).toBeNull();
    expect(grid).toContain('BUNDLE SOURCE  PASTE');
    expect(grid).toContain(`BUNDLE LENGTH  ${text.length} CHARS`);
  });
});

/** 5 MiB of filler with the sentinel in the middle. */
function bigText(): string {
  const unit = 'abcdefghij';
  const half = unit.repeat(Math.ceil((2.5 * 1024 * 1024) / unit.length));
  return `${half}${SENTINEL}${half}`;
}

describe('verify_text_held_once', () => {
  // Feature: verifier, Property 9: The Bundle_Text is held once and never drawn
  // **Validates: Requirements 3.8**
  it('verify_text_held_once: the state holds at most one string longer than 1,000 characters, after any pastes, drops and reads', () => {
    runProperty('verify_text_held_once', { seed: 20264909, numRuns: 200 }, fc.property(fc.array(feedArb, { minLength: 1, maxLength: 5 }), (feeds) => {
      let state = onVerify();
      for (const f of feeds) {
        state = feed(state, f);
        expect(longStrings(state)).toBeLessThanOrEqual(1);
      }
      // The held text is the newest one, and it is the one long string when it is long.
      const last = feeds[feeds.length - 1];
      expect(state.verify.bundleText).toBe(last?.text);
      expect(longStrings(state)).toBe((last?.text.length ?? 0) > 1000 ? 1 : 0);
    }));
  });

  it('verify_text_held_once: after a 5 MB paste the state walk finds exactly one long string, the bundle text', () => {
    const text = bigText();
    const result = update(onVerify(), { type: 'PASTE_TEXT', text });
    expect(result.effects).toEqual([]);
    expect(longStrings(result.state)).toBe(1);
    expect(result.state.verify.bundleText === text).toBe(true);
    // A second paste replaces it, so there is still one.
    const again = step(result.state, { type: 'PASTE_TEXT', text: `${text}x` });
    expect(longStrings(again)).toBe(1);
  });
});

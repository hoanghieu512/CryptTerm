import { isDeepStrictEqual } from 'node:util';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COLS, ROWS, renderGrid, renderStatusRow } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { layoutOf } from '../../src/ui/model/screens/index';
import type { Field, FieldId, ScreenId, TerminalState } from '../../src/ui/model/types';
import { initialState, update } from '../../src/ui/model/update';
import { batchArb } from '../support/ledger-arbitraries';
import { runProperty } from '../support/pbt';
import {
  ENTER,
  SCREEN_IDS,
  TINY_BATCH,
  applyAll,
  flowStepArb,
  loadAction,
  loadedSampleFor,
  loadedState,
  pf,
  pfNumberArb,
  printableCharArb,
  reachableStateArb,
  stateOn,
  step,
  typeText,
  unprintableCharArb,
  userActionArb,
} from '../support/terminal-arbitraries';

type InputField = Extract<Field, { kind: 'input' }>;

function inputsOf(state: TerminalState): InputField[] {
  return layoutOf(state).fields.filter((f): f is InputField => f.kind === 'input');
}

/** Input fields in Tab order: by row, then column. */
function sortedInputs(state: TerminalState): InputField[] {
  return inputsOf(state).sort((a, b) => a.row - b.row || a.col - b.col);
}

function textOf(state: TerminalState, id: FieldId): string {
  return state.fields[id] ?? '';
}

/** Reference of the design's `fit`: non-printable characters become `?`, then cut and pad. */
function fit(text: string, width: number): string {
  const printable = Array.from(text, (c) => (c >= ' ' && c <= '~' ? c : '?')).join('');
  return printable.slice(0, width).padEnd(width);
}

function pfBarText(state: TerminalState): string {
  return layoutOf(state)
    .pf.map((e) => `PF${e.pf} ${e.label}`)
    .join('  ');
}

// Feature: terminal-ui, Property 1: Every screen is exactly 24 rows of 80 printable characters
// **Validates: Requirements 1.1**
//
// Seed 20264001, 200 runs, over reachable states on all four screens.
describe('screen_grid_shape', () => {
  it('screen_grid_shape: 24 rows of 80 printable characters, PF_Bar on row 23, status on row 24', () => {
    runProperty('screen_grid_shape', { seed: 20264001, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      const rows = renderGrid(state);
      expect(rows).toHaveLength(24);
      for (const row of rows) {
        expect(row).toHaveLength(80);
        expect(row).toMatch(/^[\x20-\x7e]{80}$/);
      }
      expect(rows[22]).toBe(fit(pfBarText(state), 80));
      expect(rows[23]).toBe(renderStatusRow(state));
    }));
  });

  it('screen_grid_shape: the grid constants are 24 and 80', () => {
    expect(ROWS).toBe(24);
    expect(COLS).toBe(80);
  });

  it('screen_grid_shape: row 24 shows TAMPERED only when the state is tampered (never on a fresh state)', () => {
    for (const screen of SCREEN_IDS) {
      const state = stateOn(screen, TINY_BATCH);
      expect(renderStatusRow(state)).not.toContain('TAMPERED');
    }
  });
});

// Feature: terminal-ui, Property 2: The PF_Bar lists exactly the handled PF keys
// **Validates: Requirements 1.5**
//
// Seed 20264002, 200 runs. A PF key is in the bar if and only if `update` does not take the
// inactive path. The inactive path changes only `status` and emits no effect.
describe('pf_bar_matches_handlers', () => {
  it('pf_bar_matches_handlers: listed if and only if handled, with number and label shown', () => {
    runProperty('pf_bar_matches_handlers', { seed: 20264002, numRuns: 200 }, fc.property(reachableStateArb, pfNumberArb, (state, n) => {
      const layout = layoutOf(state);
      const listed = layout.pf.some((e) => e.pf === n);
      const result = update(state, { type: 'PF', pf: n });
      const inactive =
        result.effects.length === 0 && result.state.status === MESSAGES.PF_INACTIVE && sameExceptStatus(result.state, state);
      expect(listed).toBe(!inactive);
    }));
  });

  it('pf_bar_matches_handlers: every listed entry has its number and label on row 23', () => {
    runProperty('pf_bar_matches_handlers row 23', { seed: 20264002, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      const text = pfBarText(state);
      const row = renderGrid(state)[22] ?? '';
      if (text.length <= 80) {
        for (const e of layoutOf(state).pf) {
          expect(e.label.length).toBeGreaterThan(0);
          expect(row).toContain(`PF${e.pf} ${e.label}`);
        }
      }
      // No PF number appears twice and every number is 1 to 12.
      const numbers = layoutOf(state).pf.map((e) => e.pf);
      expect(new Set(numbers).size).toBe(numbers.length);
      for (const n of numbers) expect(n >= 1 && n <= 12).toBe(true);
    }));
  });

  it('pf_bar_matches_handlers: PF3 is absent on CTM000 and present on the other screens', () => {
    expect(layoutOf(stateOn('CTM000', TINY_BATCH)).pf.some((e) => e.pf === 3)).toBe(false);
    for (const screen of ['CTM100', 'CTM200', 'CTM300'] as const) {
      expect(layoutOf(stateOn(screen, TINY_BATCH)).pf.some((e) => e.pf === 3)).toBe(true);
    }
  });
});

function sameExceptStatus(a: TerminalState, b: TerminalState): boolean {
  return isDeepStrictEqual({ ...a, status: '' }, { ...b, status: '' });
}

// Feature: terminal-ui, Property 3: Tab moves through input fields in order and wraps
// **Validates: Requirements 1.2**
//
// Seed 20264003, 200 runs. After any run of Tab and Shift+Tab, the cursor field is the field at
// index (start + forward - backward) mod k of the fields sorted by (row, col). With no input
// field, the state does not change.
describe('tab_order', () => {
  it('tab_order: the cursor follows (start + forward - backward) mod k and wraps', () => {
    runProperty(
      'tab_order',
      { seed: 20264003, numRuns: 200 },
      fc.property(reachableStateArb, fc.array(fc.boolean(), { maxLength: 20 }), (state, backs) => {
        const fields = sortedInputs(state);
        const k = fields.length;
        const next = applyAll(state, backs.map((back) => ({ type: 'TAB', back }) as const));
        if (k === 0) {
          expect(next).toEqual(state);
          return;
        }
        const startId = state.cursor?.fieldId;
        const start = fields.findIndex((f) => f.id === startId);
        expect(start).toBeGreaterThanOrEqual(0);
        const delta = backs.reduce((sum, back) => sum + (back ? -1 : 1), 0);
        const index = (((start + delta) % k) + k) % k;
        const expected = fields[index];
        expect(expected).toBeDefined();
        if (backs.length > 0 && expected !== undefined) {
          expect(next.cursor?.fieldId).toBe(expected.id);
          expect(next.cursor?.offset).toBe(textOf(next, expected.id).length);
        }
      }),
    );
  });

  it('tab_order: a screen with no input field is unchanged by Tab and Shift+Tab', () => {
    const state = initialState();
    expect(update(state, { type: 'TAB', back: false }).state).toEqual(state);
    expect(update(state, { type: 'TAB', back: true }).state).toEqual(state);
  });
});

// Feature: terminal-ui, Property 4: Printable keys edit unprotected fields only
// **Validates: Requirements 1.3**
//
// Seed 20264004, 200 runs. The reference model: a character overwrites the cell at `offset` when
// `offset < value.length`, appends when the field has room, and is ignored when the field is full.
// With no cursor or a non-printable character, the state is unchanged. After any action the cursor
// is null or names an input field of the current layout.
describe('field_input_protected', () => {
  it('field_input_protected: printable keys follow the reference model in an input field', () => {
    runProperty(
      'field_input_protected',
      { seed: 20264004, numRuns: 200 },
      fc.property(
        reachableStateArb,
        fc.string({ unit: fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)), maxLength: 16 }),
        fc.nat(),
        printableCharArb,
        (base, rawText, offsetDraw, ch) => {
          const field = sortedInputs(base)[0];
          fc.pre(field !== undefined && base.cursor !== null);
          if (field === undefined) return;
          const value = rawText.slice(0, field.length);
          const offset = offsetDraw % (value.length + 1);
          const state: TerminalState = {
            ...base,
            fields: { ...base.fields, [field.id]: value },
            cursor: { fieldId: field.id, offset },
          };
          const result = update(state, { type: 'CHAR', ch }).state;
          if (offset < value.length) {
            expect(textOf(result, field.id)).toBe(`${value.slice(0, offset)}${ch}${value.slice(offset + 1)}`);
            expect(result.cursor).toEqual({ fieldId: field.id, offset: offset + 1 });
          } else if (value.length < field.length) {
            expect(textOf(result, field.id)).toBe(`${value}${ch}`);
            expect(result.cursor).toEqual({ fieldId: field.id, offset: offset + 1 });
          } else {
            expect(textOf(result, field.id)).toBe(value);
          }
        },
      ),
    );
  });

  it('field_input_protected: without a cursor, or with a non-printable key, the state is unchanged', () => {
    runProperty(
      'field_input_protected protected',
      { seed: 20264004, numRuns: 200 },
      fc.property(reachableStateArb, printableCharArb, unprintableCharArb, (state, printable, other) => {
        expect(update({ ...state, cursor: null }, { type: 'CHAR', ch: printable }).state.fields).toEqual(state.fields);
        if (state.cursor !== null) {
          expect(update(state, { type: 'CHAR', ch: other }).state).toEqual(state);
        }
      }),
    );
  });

  it('field_input_protected: CTM000 has no input field, so a printable key changes nothing', () => {
    const state = initialState();
    expect(state.cursor).toBeNull();
    expect(update(state, { type: 'CHAR', ch: 'a' }).state).toEqual(state);
  });

  it('field_input_protected: after any action the cursor is null or on an input field of the layout', () => {
    runProperty(
      'field_input_protected cursor',
      { seed: 20264004, numRuns: 200 },
      fc.property(reachableStateArb, fc.array(userActionArb, { maxLength: 15 }), (state, actions) => {
        let current = state;
        for (const action of actions) {
          current = step(current, action);
          if (current.cursor !== null) {
            const ids = inputsOf(current).map((f) => f.id);
            expect(ids).toContain(current.cursor.fieldId);
            expect(current.cursor.offset).toBeGreaterThanOrEqual(0);
            expect(current.cursor.offset).toBeLessThanOrEqual(textOf(current, current.cursor.fieldId).length);
          } else {
            expect(inputsOf(current)).toHaveLength(0);
          }
        }
      }),
    );
  });

  it('field_input_protected: Backspace removes the character before the cursor and moves back', () => {
    const typed = typeText(stateOn('CTM100', TINY_BATCH), '1');
    expect(typed.fields.select).toBe('1');
    const erased = step(typed, { type: 'BACKSPACE' });
    expect(erased.fields.select ?? '').toBe('');
    expect(erased.cursor?.offset).toBe(0);
    // Backspace at offset 0 changes nothing.
    expect(step(erased, { type: 'BACKSPACE' }).fields.select ?? '').toBe('');
  });
});

// Feature: terminal-ui, Property 7: Screens move one step at a time and PF3 keeps or discards the right state
// **Validates: Requirements 2.5, 2.6**
//
// Seed 20264007, 200 runs. Random user actions mixed with the result of the pending sample load.
// Group 1 has only the skeleton of CTM200 and CTM300, so the properties cover the move rules and
// the keep and discard rules. PF3 on CTM000 changes the status line only.
describe('screen_flow', () => {
  const order: readonly ScreenId[] = ['CTM000', 'CTM100', 'CTM200', 'CTM300'];

  it('screen_flow: one step at a time, forward on Enter or a load result, back on PF3', () => {
    runProperty(
      'screen_flow',
      { seed: 20264007, numRuns: 200 },
      fc.property(batchArb, fc.array(flowStepArb, { maxLength: 40 }), (batch, steps) => {
        let state = initialState();
        for (const s of steps) {
          const action = s.kind === 'user' ? s.action : loadAction(state, batch);
          const before = order.indexOf(state.screen);
          const next = update(state, action).state;
          const after = order.indexOf(next.screen);
          expect(before).toBeGreaterThanOrEqual(0);
          expect(after).toBeGreaterThanOrEqual(0);
          expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
          if (after > before) expect(action.type === 'ENTER' || action.type === 'SAMPLE_LOADED').toBe(true);
          if (after < before) expect(action).toEqual({ type: 'PF', pf: 3 });
          if (before === 0 && action.type === 'PF' && action.pf === 3) {
            expect(next.screen).toBe('CTM000');
          }
          if (before === 3 && after === 2) {
            expect(next.sample).toBe(state.sample);
            expect(next.edits).toEqual(state.edits);
            expect(next.page).toBe(state.page);
          }
          if (before === 2 && after === 1) {
            expect(next.sample).toBeNull();
            expect(next.edits.size).toBe(0);
            expect(next.tamper).toBe(false);
            expect(next.prove).toEqual({ kind: 'idle' });
          }
          state = next;
        }
      }),
    );
  });

  it('screen_flow: PF3 on CTM000 leaves the state as it was, apart from the status line', () => {
    const state = initialState();
    const next = update(state, pf(3));
    expect(next.state.screen).toBe('CTM000');
    expect(next.state).toEqual({ ...state, status: next.state.status });
    expect(next.effects).toEqual([]);
  });

  it('screen_flow: the skeleton path CTM000 to CTM300 and back with PF3', () => {
    const batch = TINY_BATCH;
    const s0 = initialState();
    expect(s0.screen).toBe('CTM000');
    const s1 = step(s0, ENTER);
    expect(s1.screen).toBe('CTM100');
    const s2 = loadedState(batch);
    expect(s2.screen).toBe('CTM200');
    expect(s2.sample).not.toBeNull();
    const s3 = step(s2, ENTER);
    expect(s3.screen).toBe('CTM300');
    // CTM300 to CTM200 keeps the sample, the edits and the page.
    const back3 = step(s3, pf(3));
    expect(back3.screen).toBe('CTM200');
    expect(back3.sample).toBe(s2.sample);
    expect(back3.edits).toEqual(s2.edits);
    expect(back3.page).toBe(s2.page);
    // CTM200 to CTM100 discards them.
    const back2 = step(back3, pf(3));
    expect(back2.screen).toBe('CTM100');
    expect(back2.sample).toBeNull();
    expect(back2.edits.size).toBe(0);
    expect(back2.tamper).toBe(false);
    expect(back2.prove).toEqual({ kind: 'idle' });
    // CTM100 to CTM000.
    expect(step(back2, pf(3)).screen).toBe('CTM000');
  });

  it('screen_flow: a stale load result is dropped as the same state object', () => {
    const batch = TINY_BATCH;
    const waiting = step(typeText(stepToSelect(), '1'), ENTER);
    expect(waiting.pendingLoad).not.toBeNull();
    const stale = update(waiting, {
      type: 'SAMPLE_LOADED',
      loadId: (waiting.pendingLoad ?? 0) + 99,
      sample: loadedSampleFor(batch),
    });
    expect(Object.is(stale.state, waiting)).toBe(true);
    expect(stale.effects).toEqual([]);
    // PF3 during a load, then the late result: the screen stays on CTM000.
    const left = step(waiting, pf(3));
    expect(left.screen).toBe('CTM000');
    const late = update(left, loadAction(waiting, batch));
    expect(Object.is(late.state, left)).toBe(true);
  });
});

function stepToSelect(): TerminalState {
  return step(initialState(), ENTER);
}

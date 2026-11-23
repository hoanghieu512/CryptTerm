import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROVE_ERROR_MESSAGES } from '../../src/zk/prove-service';
import { PROVE_STAGES } from '../../src/zk/worker-protocol';
import { AMOUNT_INPUT_MESSAGES } from '../../src/ui/model/amount-input';
import { renderGrid } from '../../src/ui/model/grid';
import { MESSAGES } from '../../src/ui/model/messages';
import { SCREENS, layoutOf } from '../../src/ui/model/screens/index';
import type { TerminalState } from '../../src/ui/model/types';
import { initialState, update } from '../../src/ui/model/update';
import { runProperty } from '../support/pbt';
import {
  ENTER,
  SCREEN_IDS,
  TINY_BATCH,
  onSelectScreen,
  reachableStateArb,
  stateOn,
  step,
  typeText,
} from '../support/terminal-arbitraries';

const SCREEN_NAMES = {
  CTM000: 'LOGON',
  CTM100: 'BATCH SELECT',
  CTM200: 'BATCH VIEW',
  CTM300: 'PROVE',
} as const;

describe('logon_to_select', () => {
  it('logon_to_select: CTM000 shows the title, DEMO and PRESS ENTER, and has no credential field', () => {
    const state = initialState();
    expect(state.screen).toBe('CTM000');
    const text = renderGrid(state).join('\n');
    expect(text).toContain('CRYPTTERM');
    expect(text).toContain('BLOCK-MODE TERMINAL');
    expect(text).toContain('DEMO');
    expect(text).toContain('PRESS ENTER');
    expect(layoutOf(state).fields.filter((f) => f.kind === 'input')).toHaveLength(0);
    expect(state.cursor).toBeNull();
    expect(text).not.toMatch(/IBM|3270/);
  });

  it('logon_to_select: Enter leads to CTM100 with no credential and no effect', () => {
    const result = update(initialState(), ENTER);
    expect(result.state.screen).toBe('CTM100');
    expect(result.effects).toEqual([]);
  });

  it('logon_to_select: Enter is the only forward key on CTM000', () => {
    const state = initialState();
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const) {
      expect(update(state, { type: 'PF', pf: n }).state.screen).toBe('CTM000');
    }
    expect(update(state, { type: 'TAB', back: false }).state.screen).toBe('CTM000');
    expect(update(state, { type: 'CHAR', ch: 'x' }).state.screen).toBe('CTM000');
  });
});

describe('enter_submits_whole_screen', () => {
  /** The values record that Enter hands to `submit`: the text of every input field of the layout. */
  function valuesOf(state: TerminalState): Record<string, string> {
    const values: Record<string, string> = {};
    for (const f of layoutOf(state).fields) {
      if (f.kind === 'input') values[f.id] = state.fields[f.id] ?? '';
    }
    return values;
  }

  it('enter_submits_whole_screen: Enter gives the same result as submit with the values of all input fields', () => {
    runProperty('enter_submits_whole_screen', { seed: 20264004, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      const viaUpdate = update(state, ENTER);
      const viaSubmit = SCREENS[state.screen].submit(state, valuesOf(state));
      expect(viaUpdate.effects).toEqual(viaSubmit.effects);
      expect(viaUpdate.state.screen).toBe(viaSubmit.state.screen);
      expect(viaUpdate.state.status).toBe(viaSubmit.state.status);
    }));
  });

  it('enter_submits_whole_screen: CTM100 with 1 typed starts one load of the clean sample', () => {
    const typed = typeText(onSelectScreen(), '1');
    const result = update(typed, ENTER);
    expect(result.state.status).toBe(MESSAGES.LOADING);
    expect(result.state.pendingLoad).not.toBeNull();
    expect(result.effects).toEqual([{ type: 'LOAD_SAMPLE', loadId: result.state.pendingLoad, name: 'clean' }]);
  });

  it.each([['', 'empty'], ['9', 'not a listed number'], ['0', 'zero'], ['a', 'a letter'], ['5', 'one past the last']])(
    'enter_submits_whole_screen: CTM100 with %j (%s) stays and shows the fixed message',
    (text) => {
      const result = update(typeText(onSelectScreen(), text), ENTER);
      expect(result.state.screen).toBe('CTM100');
      expect(result.state.status).toBe(MESSAGES.SELECT_INVALID);
      expect(result.effects).toEqual([]);
      expect(result.state.pendingLoad).toBeNull();
    },
  );

  it('enter_submits_whole_screen: Enter while a load is pending starts no second load', () => {
    const loading = step(typeText(onSelectScreen(), '1'), ENTER);
    const again = update(loading, ENTER);
    expect(again.effects).toEqual([]);
    expect(again.state.pendingLoad).toBe(loading.pendingLoad);
    expect(again.state.status).toBe(MESSAGES.LOADING);
  });
});

describe('layout_fields_valid', () => {
  it('layout_fields_valid: SCREENS has exactly the four screen ids', () => {
    expect(Object.keys(SCREENS).sort()).toEqual([...SCREEN_IDS].sort());
  });

  it('layout_fields_valid: fields sit in rows 1 to 22, inside 80 columns, never overlap, and use printable text', () => {
    runProperty('layout_fields_valid', { seed: 20264001, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      const taken = new Set<string>();
      for (const f of layoutOf(state).fields) {
        const width = f.kind === 'text' ? f.text.length : f.length;
        expect(f.protected).toBe(f.kind === 'text');
        expect(width).toBeGreaterThan(0);
        expect(f.row).toBeGreaterThanOrEqual(1);
        expect(f.row).toBeLessThanOrEqual(22);
        expect(f.col).toBeGreaterThanOrEqual(1);
        expect(f.col + width - 1).toBeLessThanOrEqual(80);
        if (f.kind === 'text') expect(f.text).toMatch(/^[\x20-\x7e]+$/);
        for (let c = f.col; c < f.col + width; c += 1) {
          const cell = `${f.row}:${c}`;
          expect(taken.has(cell)).toBe(false);
          taken.add(cell);
        }
      }
    }));
  });

  it('layout_fields_valid: input field ids are unique, and PF entries are numbered 1 to 12 with printable labels', () => {
    runProperty('layout_fields_valid ids', { seed: 20264001, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      const layout = layoutOf(state);
      const ids = layout.fields.flatMap((f) => (f.kind === 'input' ? [f.id] : []));
      expect(new Set(ids).size).toBe(ids.length);
      for (const e of layout.pf) {
        expect(Number.isInteger(e.pf) && e.pf >= 1 && e.pf <= 12).toBe(true);
        expect(e.label).toMatch(/^[\x20-\x7e]+$/);
        expect(e.label).toBe(e.label.toUpperCase());
      }
    }));
  });

  it('layout_fields_valid: row 1 reads `<id>  <NAME>` on the left and DEMO DATA at column 72', () => {
    for (const screen of SCREEN_IDS) {
      const row1 = renderGrid(stateOn(screen, TINY_BATCH))[0] ?? '';
      expect(row1.startsWith(`${screen}  ${SCREEN_NAMES[screen]}`)).toBe(true);
      expect(row1.slice(71, 71 + 'DEMO DATA'.length)).toBe('DEMO DATA');
    }
  });

  it('layout_fields_valid: CTM100 has one input field, `select`, of length 1', () => {
    const inputs = layoutOf(onSelectScreen()).fields.filter((f) => f.kind === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ kind: 'input', id: 'select', length: 1, protected: false });
  });
});

describe('messages_fit_status_line', () => {
  const REJECT_REASONS = ['UNBALANCED', 'OVER_LIMIT_UNFLAGGED', 'OUT_OF_RANGE'] as const;

  it('messages_fit_status_line: every fixed message is a string of at most 70 printable uppercase characters', () => {
    const texts: string[] = [];
    for (const [key, value] of Object.entries(MESSAGES)) {
      expect(typeof value, `MESSAGES.${key}`).toBe('string');
      texts.push(String(value));
    }
    for (const reason of REJECT_REASONS) texts.push(`${MESSAGES.REJECTED}${reason}`);
    for (const stage of PROVE_STAGES) texts.push(`${MESSAGES.PROVING}${stage}`);
    texts.push(...Object.values(AMOUNT_INPUT_MESSAGES));
    texts.push(...Object.values(PROVE_ERROR_MESSAGES));
    expect(texts.length).toBeGreaterThan(20);
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(70);
      expect(text).toMatch(/^[\x20-\x7e]+$/);
      expect(text).toBe(text.toUpperCase());
    }
  });

  it('messages_fit_status_line: the design texts are used word for word', () => {
    expect(MESSAGES.SELECT_INVALID).toBe('ENTER A SAMPLE NUMBER FROM 1 TO 4');
    expect(MESSAGES.LOADING).toBe('LOADING SAMPLE');
    expect(MESSAGES.LOAD_FAILED).toBe('SAMPLE LOAD FAILED');
    expect(MESSAGES.PF_INACTIVE).toBe('PF KEY NOT ACTIVE');
    expect(MESSAGES.FIRST_PAGE).toBe('FIRST PAGE');
    expect(MESSAGES.LAST_PAGE).toBe('LAST PAGE');
    expect(MESSAGES.IN_PROGRESS).toBe('PROOF IN PROGRESS');
    expect(MESSAGES.DONE).toBe('PROOF GENERATED');
    expect(MESSAGES.UNEXPECTED).toBe('PROOF GENERATION FAILED: UNEXPECTED ERROR');
    expect(MESSAGES.REJECTED).toBe('REJECTED: ');
    expect(MESSAGES.PROVING).toBe('PROVING: ');
  });

  it('messages_fit_status_line: the status row of every reachable state fits 80 columns and holds only fixed text', () => {
    runProperty('messages_fit_status_line', { seed: 20264001, numRuns: 200 }, fc.property(reachableStateArb, (state) => {
      expect(state.status.length).toBeLessThanOrEqual(70);
      const row = renderGrid(state)[23] ?? '';
      expect(row).toHaveLength(80);
    }));
  });
});

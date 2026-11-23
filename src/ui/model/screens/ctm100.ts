// CTM100 BATCH SELECT: the four samples and one selection field. Enter starts one load.
// The status text comes from MESSAGES only. The typed text is never echoed.
import { MESSAGES } from '../messages';
import { goTo } from '../navigation';
import { SAMPLES, sampleByNumber } from '../samples';
import type { Field, ScreenDef } from '../types';
import { headerFields, inputField, textField } from './common';

const MENU_FIRST_ROW = 5;
const SELECT_ROW = 11;
const SELECT_LABEL = 'SELECT NO:';

export const ctm100: ScreenDef = {
  layout() {
    const rows: Field[] = SAMPLES.flatMap((s, i) => [
      textField(MENU_FIRST_ROW + i, 5, s.no),
      textField(MENU_FIRST_ROW + i, 9, s.label),
      textField(MENU_FIRST_ROW + i, 32, s.note),
    ]);
    return {
      fields: [
        ...headerFields('CTM100'),
        ...rows,
        textField(SELECT_ROW, 5, SELECT_LABEL),
        inputField('select', SELECT_ROW, 5 + SELECT_LABEL.length + 1, 1),
      ],
      pf: [{ pf: 3, label: 'BACK', run: (state) => ({ state: goTo(state, 'CTM000'), effects: [] }) }],
    };
  },
  submit(state, values) {
    if (state.pendingLoad !== null) {
      return { state: { ...state, status: MESSAGES.LOADING }, effects: [] };
    }
    const sample = sampleByNumber(values['select'] ?? '');
    if (sample === null) {
      return { state: { ...state, status: MESSAGES.SELECT_INVALID }, effects: [] };
    }
    const loadId = state.nextLoadId;
    return {
      state: { ...state, pendingLoad: loadId, nextLoadId: loadId + 1, status: MESSAGES.LOADING },
      effects: [{ type: 'LOAD_SAMPLE', loadId, name: sample.name }],
    };
  },
};

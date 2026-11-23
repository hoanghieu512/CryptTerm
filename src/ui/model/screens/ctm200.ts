// CTM200 BATCH VIEW: skeleton (title, PF3 and the hint row). Task 2.3 replaces it with the
// batch view, digest status, paging and tamper mode.
import { goTo } from '../navigation';
import type { ScreenDef } from '../types';
import { headerFields, textField } from './common';

export const ctm200: ScreenDef = {
  layout() {
    return {
      fields: [...headerFields('CTM200'), textField(22, 1, 'ENTER: PROVE SCREEN')],
      pf: [{ pf: 3, label: 'BACK', run: (state) => ({ state: goTo(state, 'CTM100'), effects: [] }) }],
    };
  },
  submit(state) {
    return { state: goTo(state, 'CTM300'), effects: [] };
  },
};

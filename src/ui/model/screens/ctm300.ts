// CTM300 PROVE: skeleton (title and PF3). Group 3 adds the limit field and the prove flow.
import { goTo } from '../navigation';
import type { ScreenDef } from '../types';
import { headerFields } from './common';

export const ctm300: ScreenDef = {
  layout() {
    return {
      fields: headerFields('CTM300'),
      pf: [{ pf: 3, label: 'BACK', run: (state) => ({ state: goTo(state, 'CTM200'), effects: [] }) }],
    };
  },
  submit(state) {
    return { state, effects: [] };
  },
};

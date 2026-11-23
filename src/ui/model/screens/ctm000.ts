// CTM000 LOGON: title and PRESS ENTER. No credential field, no PF key. Enter leads to CTM100.
import { goTo } from '../navigation';
import type { ScreenDef } from '../types';
import { centred, headerFields } from './common';

export const ctm000: ScreenDef = {
  layout() {
    return {
      fields: [
        ...headerFields('CTM000'),
        centred(6, 'CRYPTTERM'),
        centred(8, 'BLOCK-MODE TERMINAL'),
        centred(10, 'DEMO'),
        centred(14, 'PRESS ENTER'),
      ],
      pf: [],
    };
  },
  submit(state) {
    return { state: goTo(state, 'CTM100'), effects: [] };
  },
};

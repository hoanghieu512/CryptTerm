// CTM900 VERIFY (verifier design, "CTM900 screen"). Rows 1 to 8 hold the title, the bundle source
// and length, the policy limit field and the hint. Row 20 holds the verifier's own circuit
// version, then the PF_Bar on row 23 and the status line on row 24 (both drawn by the grid).
//
// The layout reads `bundleText` only for `.length`. No row holds any part of it. Rows 10 to 18
// (steps, verdict, key id) are added by task 2.3.
import { CIRCUIT_VERSION } from '../../../zk/circuit-identity';
import type { PfEntry, ScreenDef, ScreenLayout } from '../types';
import { leaveVerify, startVerify } from '../verify-flow';
import { headerFields, inputField, textField } from './common';

const SOURCE_ROW = 3;
const LENGTH_ROW = 4;
const LIMIT_ROW = 6;
const LIMIT_LABEL = 'POLICY LIMIT (CENTS)';
const LIMIT_LENGTH = 13;
const HINT_ROW = 8;
const CIRCUIT_ROW = 20;

export const ctm900: ScreenDef = {
  layout(state): ScreenLayout {
    const pf: PfEntry[] = [{ pf: 3, label: 'BACK', run: leaveVerify }];
    return {
      fields: [
        ...headerFields('CTM900'),
        textField(SOURCE_ROW, 1, `BUNDLE SOURCE  ${state.verify.source}`),
        textField(LENGTH_ROW, 1, `BUNDLE LENGTH  ${state.verify.bundleText.length} CHARS`),
        textField(LIMIT_ROW, 1, LIMIT_LABEL),
        inputField('limit', LIMIT_ROW, LIMIT_LABEL.length + 2, LIMIT_LENGTH),
        textField(HINT_ROW, 1, 'PASTE A BUNDLE OR DROP A .JSON FILE, THEN PRESS ENTER'),
        textField(CIRCUIT_ROW, 1, `VERIFIER CIRCUIT ${CIRCUIT_VERSION}`),
      ],
      pf,
    };
  },
  submit: startVerify,
};

// CTM900 VERIFY (verifier design, "CTM900 screen"). Rows 1 to 8 hold the title, the bundle source
// and length, the policy limit field and the hint. Rows 10 to 15 hold one Step_Row per verifier
// step, row 17 the verdict, row 18 the source key id, and row 20 the verifier's own circuit
// version. The PF_Bar is on row 23 and the status line on row 24 (both drawn by the grid).
//
// The layout reads `bundleText` only for `.length`. The step rows, the verdict and the key row are
// built from a count of passed steps, fixed texts and the key table, never from a report or a
// bundle: nothing a verifier returns, other than the step names and `ok` flags that were reduced
// to that count, can reach the grid. The word VERIFIED exists in this file once, in `verdictText`.
import { CIRCUIT_VERSION } from '../../../zk/circuit-identity';
import { VERIFY_DETAILS } from '../../../zk/verifier';
import { MESSAGES } from '../messages';
import type { Field, PfEntry, ScreenDef, ScreenLayout, TerminalState, VerifyOutcome } from '../types';
import { VERIFY_STEP_ORDER, leaveVerify, startVerify, verifyShown } from '../verify-flow';
import { headerFields, inputField, textField } from './common';

const SOURCE_ROW = 3;
const LENGTH_ROW = 4;
const LIMIT_ROW = 6;
const LIMIT_LABEL = 'POLICY LIMIT (CENTS)';
const LIMIT_LENGTH = 13;
const HINT_ROW = 8;
const FIRST_STEP_ROW = 10;
const VERDICT_ROW = 17;
const KEY_ROW = 18;
const CIRCUIT_ROW = 20;
const NAME_WIDTH = 12;
const RESULT_WIDTH = 7;
const DEMO_KEY_LABEL = 'DEMO KEY';

/** `<STEP padded to 12>  <OK|FAIL padded to 7>  <detail>`, or `<STEP>  NOT RUN`. */
function stepRow(i: number, passed: number): string {
  const name = VERIFY_STEP_ORDER[i];
  if (name === undefined) return '';
  const label = name.padEnd(NAME_WIDTH);
  if (i < passed) return `${label}  ${'OK'.padEnd(RESULT_WIDTH)}  ${VERIFY_DETAILS[name].ok}`;
  if (i === passed) return `${label}  ${'FAIL'.padEnd(RESULT_WIDTH)}  ${VERIFY_DETAILS[name].fail}`;
  return `${label}  NOT RUN`;
}

/** The Verdict_Row text. VERIFIED only for six passed steps. */
function verdictText(state: TerminalState, outcome: VerifyOutcome | null): string | null {
  if (state.verify.run !== null) return MESSAGES.VERIFYING;
  if (outcome === null) return null;
  if (outcome.kind === 'error') return MESSAGES.VERIFIER_ERROR;
  if (outcome.passed === VERIFY_STEP_ORDER.length) return 'VERIFIED';
  const failed = VERIFY_STEP_ORDER[outcome.passed];
  return failed === undefined ? MESSAGES.VERIFIER_ERROR : `REJECTED AT ${failed}`;
}

/** The step rows, the verdict and the key row for what is on screen. */
function resultFields(state: TerminalState): Field[] {
  const outcome = verifyShown(state);
  const fields: Field[] = [];
  if (outcome !== null && outcome.kind === 'report') {
    VERIFY_STEP_ORDER.forEach((_, i) => fields.push(textField(FIRST_STEP_ROW + i, 1, stepRow(i, outcome.passed))));
    if (outcome.keyId !== null) fields.push(textField(KEY_ROW, 1, `SOURCE KEY ${outcome.keyId}  ${DEMO_KEY_LABEL}`));
  }
  const verdict = verdictText(state, outcome);
  if (verdict !== null) fields.push(textField(VERDICT_ROW, 1, verdict));
  return fields;
}

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
        ...resultFields(state),
        textField(CIRCUIT_ROW, 1, `VERIFIER CIRCUIT ${CIRCUIT_VERSION}`),
      ],
      pf,
    };
  },
  submit: startVerify,
};

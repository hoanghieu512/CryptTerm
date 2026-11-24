// The four screen definitions, keyed by screen id.
import type { ScreenDef, ScreenId, ScreenLayout, TerminalState } from '../types';
import { ctm000 } from './ctm000';
import { ctm100 } from './ctm100';
import { ctm200 } from './ctm200';
import { ctm300, verdictRowOf as ctm300VerdictRow } from './ctm300';
import { ctm900, verdictRowOf as ctm900VerdictRow } from './ctm900';

export const SCREENS: Readonly<Record<ScreenId, ScreenDef>> = Object.freeze({
  CTM000: ctm000,
  CTM100: ctm100,
  CTM200: ctm200,
  CTM300: ctm300,
  CTM900: ctm900,
});

export function layoutOf(state: TerminalState): ScreenLayout {
  return SCREENS[state.screen].layout(state);
}

/** The 1-based body row drawn as the verdict (inverse video) on the current screen, or null. */
export function verdictRowFor(state: TerminalState): number | null {
  if (state.screen === 'CTM300') return ctm300VerdictRow(state);
  if (state.screen === 'CTM900') return ctm900VerdictRow(state);
  return null;
}

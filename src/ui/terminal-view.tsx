// The block-mode terminal as HTML (terminal-ui design, section I). Presentational only: it draws
// `renderGrid(state)` and reports PF button presses through `onPf`. It owns no state, reads no key
// and has no `<input>`: the document listener in `app.tsx` is the only key source.
//
// Rows 1 to 22 are `<pre>` lines, row 23 is the PF_Bar (one button per handled PF key, from the
// same list the handlers use) and row 24 is the status line. When a proof exists, the full
// Verify_Link is the `href` of a real anchor under the grid (text OPEN VERIFIER). It is the only `href` in the view and it holds only
// the public bundle (Requirement 9.2).
import type { CSSProperties } from 'react';
import { BODY_ROWS, STATUS_ROW, cursorCell, inputFields, renderGrid } from './model/grid';
import { layoutOf, verdictRowFor } from './model/screens/index';
import type { PfNumber, TerminalState } from './model/types';
import { SCANLINE_ALPHA, THEME } from './theme';

export interface TerminalViewProps {
  readonly state: TerminalState;
  readonly onPf: (pf: PfNumber) => void;
}

// The palette and metrics reach the stylesheet as variables, so `theme.ts` stays the one source.
const ROOT_VARIABLES = {
  '--ct-ground': THEME.palette.ground,
  '--ct-text': THEME.palette.text,
  '--ct-dim': THEME.palette.dim,
  '--ct-inverse': THEME.palette.inverse,
  '--ct-font': THEME.fontStack,
  '--ct-lh': String(THEME.lineHeight),
  '--ct-scanline-alpha': String(SCANLINE_ALPHA),
} as CSSProperties; // custom properties are not part of CSSProperties

/** Left and top of a 1-based grid cell, in character and line units. */
function cellStyle(row: number, col: number): CSSProperties {
  return { left: `${col - 1}ch`, top: `calc(${row - 1} * 1lh)` };
}

export function TerminalView({ state, onPf }: TerminalViewProps) {
  const rows = renderGrid(state);
  const layout = layoutOf(state);
  const cursor = cursorCell(state);
  const fields = inputFields(state);
  const verdictRow = verdictRowFor(state);
  const link = state.prove.kind === 'done' ? state.prove.link : null;
  return (
    <div className="ct-root" style={ROOT_VARIABLES}>
      <div className="ct-frame">
        <div className="ct-grid" role="group" aria-label={`SCREEN ${state.screen}`}>
          {fields.map((f) => (
            <span
              key={f.id}
              className="ct-field"
              aria-hidden="true"
              style={{ ...cellStyle(f.row, f.col), width: `${f.length}ch` }}
            />
          ))}
          {rows.slice(0, BODY_ROWS).map((text, i) => (
            // The rows are fixed by position, so the index is the identity of a row.
            <pre key={i} className={i === 0 || i === (verdictRow ?? 0) - 1 ? 'ct-row ct-row-title' : 'ct-row'}>
              {text}
            </pre>
          ))}
          {cursor === null ? null : (
            <span className="ct-cursor" aria-hidden="true" style={cellStyle(cursor.row, cursor.col)} />
          )}
        </div>
        <div className="ct-pfbar">
          {layout.pf.map((entry) => (
            <button
              key={entry.pf}
              type="button"
              className="ct-pf"
              data-testid={`pf-${entry.pf}`}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPf(entry.pf)}
            >
              {`PF${entry.pf} ${entry.label}`}
            </button>
          ))}
        </div>
        <pre className="ct-row ct-row-status" role="status" aria-live="polite">
          {(rows[STATUS_ROW - 1] ?? '').trimEnd()}
        </pre>
        {link === null ? null : (
          <div className="ct-link-box">
            <a data-testid="verify-link" className="ct-link" href={link} rel="noopener">
              OPEN VERIFIER
            </a>
          </div>
        )}
      </div>
      <div className="ct-scanlines" aria-hidden="true" />
      <div className="ct-glow" aria-hidden="true" />
    </div>
  );
}

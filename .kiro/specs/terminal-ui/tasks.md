# Implementation Plan: terminal-ui

## Overview

This plan builds the prover side of CryptTerm: the pure terminal model, the sample loader, CTM200 with tamper mode, the CTM300 prove flow with its effect host, then the React shell, scans, Playwright runs and the production build checks. Task 0 commits the spec files. Four groups follow. Each group runs in its own fresh chat and ends with a group checkpoint (tests, typecheck, commit by name, no push) and then STOPS for huynh and Claude review. Tests come before implementation inside every group.

Evidence before status (`structure.md`): a task is marked completed only after its "Done when" command was run in this session and the report quotes the command and its output. Never report a hash, a file, a size or an output that was not produced in this session.

Rules for every task:

1. No existing file in `src/zk` or `src/ledger` changes. The only new `src/ledger` file is `mask.ts`. Existing files outside the new ones that this spec edits are `src/main.tsx`, `src/ui/app.tsx`, `index.html`, `package.json`, `package-lock.json` and `tsconfig.json` (group 4 only). If anything else must change (including `vite.config.ts` or the vitest `include`), STOP and ask huynh. Spike files stay untouched.
2. No new runtime dependency. The only new package is the dev dependency `@playwright/test` 1.62.0 (exact pin, task 4.2).
3. Amounts are `bigint` cents. No `Number`, `parseInt` or `parseFloat` on an amount. No `console.*`, no network call other than the `fetch` in `src/ui/sample-loader.ts`, and no storage of batch data. Test data is synthetic. The words "IBM" and "3270" appear nowhere.
4. Property tests use `runProperty` from `tests/support/pbt.ts` with the fixed seed and `numRuns` of the design "Testing Strategy" table (at least 200 runs), a comment `Feature: terminal-ui, Property <n>: <text>`, and a test title that contains the name from the design table, so `npx vitest run <path> -t <name>` selects it. A real bug found by a property gets a regression example and an entry in `tests/PBT-LOG.md`.
5. Look up before writing. Check current docs (Context7 or the official site) before writing Playwright, Vite preview or React 19 code, and record in the report what was looked up.
6. Commit policy. Stage files by name, never `git add -A` or `git add .`. Run `git status --short` before each commit. Never amend. NEVER push. Each group's commit also stages `.kiro/specs/terminal-ui/tasks.md`.
7. Use `--run` modes only (`vitest run`). Never start `npm run dev`. `npm run test:e2e` starts and stops its own preview server and runs with an explicit timeout of at least 600000 ms.
8. Typecheck is `npm run typecheck` (`tsc --noEmit`). It fails in the middle of a group, because tests import files that do not exist yet. Each Done-when says where it is first required to exit 0.
9. Names (files, exports, test titles) are exactly those of `design.md`.

## Tasks

- [ ] 0. Commit the spec files
  - Run `git status --short` first. Stage by name: `git add .kiro/specs/terminal-ui/requirements.md .kiro/specs/terminal-ui/design.md .kiro/specs/terminal-ui/tasks.md .kiro/specs/terminal-ui/.config.kiro`. Commit with the message `spec(terminal-ui): requirements, design, tasks`. Never push. Run by the orchestrator right after this file is generated.
  - Done when: `git log -1 --oneline` prints `spec(terminal-ui): requirements, design, tasks` (quoted).
  - _Requirements: none (process task)_

- [ ] 1. Group 1: pure foundations (mask, amount input, key handler, grid and screen core)
  - Needs from earlier groups: nothing new. Reuses existing `src/ledger` exports (`Batch`, `Posting`, `POSTING_COLUMNS`, `padDigits`, `ID_MAX`, `AMOUNT_BOUND_CENTS`, `LIMIT_CENTS`, `SIDE_DEBIT_LETTER`, `SIDE_CREDIT_LETTER`, `checkBatch`, `SignedDigest`) and `src/zk` exports (`ProofBundle`, `PROVE_STAGES`, `ProveReason`) as types and values, and `tests/support/pbt.ts`, `ledger-arbitraries.ts`, `bundle-arbitraries.ts`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 4.1, 4.4, 5.1, 5.2, 5.3, 5.5_

  - [ ] 1.1 Write the failing tests for the pure foundations
    - Create `tests/ledger/mask.prop.test.ts` (`mask_account`, P8, seed 20264008, plus examples `0`, `7`, `9999`, `10000`, `ID_MAX`). Create under `tests/ui/`: `format_cents_roundtrip` (P12, 20264012), `tamper_input_validation` valid and invalid halves only (P13, P14, seeds 20264013 and 20264014, boundary examples `0`, `1099511627775`, `1099511627776`, values within 4 of `2^53`, `abc`, `-5`, empty, `007`, `12345678901234`, `9007199254740993`, sentinel digits absent from rendered rows), `pf5_does_not_reload` and `f11_f12_not_handled` (P5, 20264005), `alt_bindings_work` (P6, 20264006, 12 macOS examples), `pf_bar_buttons_match_keys`, `screen_grid_shape` (P1, 20264001), `pf_bar_matches_handlers` (P2, 20264002), `tab_order` (P3, 20264003), `field_input_protected` (P4, 20264004), `enter_submits_whole_screen`, `screen_flow` (P7, 20264007, CTM000 to CTM300 skeleton and PF3), `logon_to_select`, `layout_fields_valid`, `messages_fit_status_line`. Create `tests/support/terminal-arbitraries.ts` (`keyEventArb`, `userActionArb`, `sampleStateArb(batch)` that drives CTM000, CTM100 and a `SAMPLE_LOADED` action). Properties range over `SCREENS`, so they cover the richer CTM200 and CTM300 layouts when those arrive.
    - Done when: `npx vitest run tests/ledger/mask.prop.test.ts tests/ui` fails because `src/ledger/mask` and `src/ui/model/*` cannot be imported (output quoted before any implementation exists).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 4.1, 4.4, 5.1, 5.2, 5.3, 5.5_

  - [ ] 1.2 Implement `mask.ts`, `types.ts`, `amount-input.ts` and `keys.ts`
    - New files: `src/ledger/mask.ts` (`maskAccount`, `MASK_CHAR`, `MASK_WIDTH`, `VISIBLE_DIGITS`, fail closed with 20 mask characters), `src/ui/model/types.ts` (all types of design section A), `src/ui/model/amount-input.ts` (`parseAmountInput`, `AMOUNT_INPUT_MESSAGES`, `formatCents`, no `Number` step, length check before `BigInt`), `src/ui/model/keys.ts` (`KeyEventLike`, `handleKey`, `pfAction`, frozen F1 to F10 table, `ALT_CODES` matched on `code`, F11 and F12 never handled).
    - Done when: `npx vitest run tests/ledger/mask.prop.test.ts tests/ui -t "mask_account|format_cents_roundtrip|tamper_input_validation|f11_f12_not_handled|alt_bindings_work"` passes (summary line quoted).
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.4, 5.1, 5.2, 5.3, 5.5_

  - [ ] 1.3 Implement the grid, screens CTM000 to CTM300 skeleton and `update`, then Group checkpoint
    - New files: `src/ui/model/messages.ts` (`MESSAGES`), `samples.ts` (`SAMPLES`, `SampleName`, `sampleByNumber`), `grid.ts` (`ROWS`, `COLS`, `renderGrid`, `renderStatusRow`, `inputFields`, `cursorCell`), `screens/ctm000.ts`, `ctm100.ts` (menu and selection field), `ctm200.ts` and `ctm300.ts` (skeleton: title, PF3 only), `screens/index.ts` (`SCREENS`, `layoutOf`), `navigation.ts` (`goTo`), `update.ts` (`initialState`, `update`, `settle`, field editing, Tab, Enter, PF dispatch, stale-action drop). No effect is emitted yet.
    - Group checkpoint: run `npm test` and `npm run typecheck`, run `git status --short`, stage by name the new `src/ledger/mask.ts`, `src/ui/model/*`, the new test and support files and `.kiro/specs/terminal-ui/tasks.md`, commit `feat(terminal-ui): mask, amount input, key handler and screen model core`, never push, then STOP for huynh and Claude review.
    - Done when: `npm test` passes with all 1.1 tests included, `npm run typecheck` exits 0, and `git log -1 --oneline` shows the commit message (outputs quoted).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 2.5, 2.6, 3.1_

- [ ] 2. Group 2: CTM100 and CTM200 (sample loader, batch view, digest status, tamper mode)
  - Needs from group 1: `src/ledger/mask.ts` (`maskAccount`), `src/ui/model/types.ts`, `amount-input.ts` (`parseAmountInput`, `formatCents`, `AMOUNT_INPUT_MESSAGES`), `keys.ts`, `messages.ts`, `samples.ts` (`SAMPLES`, `sampleByNumber`), `grid.ts` (`renderGrid`), `screens/index.ts` (`SCREENS`, `layoutOf`), `navigation.ts`, `update.ts` (`initialState`, `update`), and `tests/support/terminal-arbitraries.ts`. The skeleton `ctm200.ts` is replaced in this group. Existing `src/ledger` exports used: `parseBatch`, `isSignedDigestShape`, `verifyDigest`, `TRUSTED_SOURCE_KEYS`, `checkInvariants`.
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 2.1 Write the failing tests for loading, batch view and tamper mode
    - Under `tests/ui/`: `batch_select_lists_samples`, `sample_load` (all four samples, fake fetch that serves the committed `public/samples` files and records URLs), `sample_load_failure` (one case per defect, sentinel text planted in served files and absent from the message), `digest_status` (four samples, unknown key id, `__proto__`, flipped signature byte, edit then compare: row 3 holds `(ORIGINAL BATCH)` and `TAMPERED`, text unchanged by the edit, no claim about the Working_Batch), `masked_accounts` (P9, 20264009, every page of the four samples before and after edits), `paging_covers_all_postings` (P10, 20264010), `totals_match_invariants` (P11, 20264011), `tamper_toggle`, `tamper_input_validation` atomic half (P15, 20264015, and one example per error class), `tamper_edits_accumulate` with the move-one-cent example (P16, 20264016), `tamper_status`, `tamper_keeps_digest` (P17, 20264017). Extend `tests/support/terminal-arbitraries.ts` with the fake `fetch`.
    - Done when: `npx vitest run tests/ui -t "batch_select_lists_samples|sample_load|digest_status|masked_accounts|paging_covers_all_postings|totals_match_invariants|tamper_toggle|tamper_edits_accumulate|tamper_status|tamper_keeps_digest"` fails because `src/ui/sample-loader`, `src/ui/model/digest-status` and `src/ui/model/tamper` cannot be imported (output quoted before any implementation exists).
    - _Requirements: 3.2, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5, 4.6, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 2.2 Implement the sample loader, digest status and tamper helpers
    - New files: `src/ui/sample-loader.ts` (`createSampleLoader`, `FetchLike`, the only `fetch` under `src/ui`, URLs `/samples/<name>.dat` and `/samples/<name>.digest.json` built from the `SAMPLES` table, fixed rejection with no text), `src/ui/model/digest-status.ts` (`checkSignature`, own-property key lookup, any throw gives `false`), `src/ui/model/tamper.ts` (`workingBatch`, `isTampered`, `pageSlots`, `applyAmountEdits`, atomic, original digest never touched).
    - Done when: `npx vitest run tests/ui -t "sample_load|sample_load_failure"` passes (summary line quoted). `digest_status` and the tamper tests pass in 2.3, once the screen exists.
    - _Requirements: 3.3, 3.4, 3.5, 4.5, 6.2, 6.4, 6.5_

  - [ ] 2.3 Implement CTM100 loading and the CTM200 screen, then Group checkpoint
    - Edit `src/ui/model/screens/ctm100.ts` (Enter sets `pendingLoad`, status `LOADING SAMPLE`, emits `LOAD_SAMPLE`; stale `SAMPLE_LOADED` and `SAMPLE_FAILED` dropped by load id) and replace `screens/ctm200.ts` (batch id, count, page, digest status row with `TAMPERED` at column 40, 12 posting rows with `maskAccount`, totals through `formatCents`, PF7 and PF8 paging, PF12 tamper toggle with `amt:<slot>` fields at column 67, `NEW CENTS` header, Enter applies edits or moves to CTM300). Wire `update.ts` to `tamper.ts` and `goTo` keep and discard rules (design section "Screen flow"). `checkSignature` runs in the host (group 3), so tests set `signatureValid` through `SAMPLE_LOADED`.
    - Group checkpoint: run `npm test` and `npm run typecheck`, run `git status --short`, stage by name the new and changed `src/ui` files, the new test and support files and `.kiro/specs/terminal-ui/tasks.md`, commit `feat(terminal-ui): sample loading, batch view and tamper mode`, never push, then STOP for huynh and Claude review.
    - Done when: `npm test` passes with all 2.1 tests included, `npm run typecheck` exits 0, and `git log -1 --oneline` shows the commit message (outputs quoted).
    - _Requirements: 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 4.6, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 3. Group 3: CTM300 prove flow and the effect host
  - Needs from groups 1 and 2: `src/ui/model/types.ts` (`Action`, `Effect`, `TerminalState`, `ProveState`), `update.ts` (`initialState`, `update`), `grid.ts` (`renderGrid`), `tamper.ts` (`workingBatch`, `isTampered`), `digest-status.ts` (`checkSignature`), `sample-loader.ts` (`createSampleLoader`), `samples.ts`, `messages.ts`, `screens/ctm300.ts` (skeleton), `tests/support/terminal-arbitraries.ts`. Existing `src/zk` exports used: `ProveService`, `createProveService`, `ProveError`, `PROVE_ERROR_MESSAGES`, `PROVE_STAGES`, `encodeBundleForUrl`, `decodeBundle`, `bundleToJson`, and `tests/support/in-process-port.ts` for the stub backend.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 3.1 Write the failing tests for the prove flow and the host
    - Create `tests/support/fake-prove.ts` (fake `ProveService`: records every call, holds each run until `resolve`, `reject` or `progress` is called, counts `cancelProve`). Under `tests/ui/`: `limit_field_prefill_and_rules`, `precheck_rejects_without_worker` (P18, 20264018, fake port has zero calls), `prove_progress_stages`, `single_proof_at_a_time` (P19, 20264019), `prove_error_display` (P20, 20264020, nine reasons plus thrown sentinels), `leave_mid_proof` (P21, 20264021, settle order), `prove_success_screen` (no word VERIFIED before, during or after a run), `tamper_cases_on_ctm300` (1-cent edit gives `REJECTED: UNBALANCED`, balanced move gives a bundle), `bundle_actions` (P22, 20264022, effects hold only the bundle text, rejecting clipboard gives `COPY FAILED`), `verify_link_roundtrip` (P23, 20264023), `bundle_dropped_on_change` (P24, 20264024), `sample_load_through_host` (host runs `checkSignature` and dispatches `SAMPLE_LOADED`), and one example `leave_mid_proof` with the real `createProveService` and a stub backend over `createInProcessPort`, for the cancel timing of design risk 10 (the clear is synchronous and the `CANCELLED` rejection arrives later and is dropped).
    - Done when: `npx vitest run tests/ui -t "limit_field_prefill_and_rules|precheck_rejects_without_worker|single_proof_at_a_time|leave_mid_proof|prove_error_display|prove_success_screen|bundle_actions|verify_link_roundtrip|bundle_dropped_on_change|sample_load_through_host"` fails because `src/ui/model/prove-flow`, `links` and `terminal` cannot be imported (output quoted before any implementation exists).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 3.2 Implement links, the prove flow and the CTM300 screen
    - New files: `src/ui/model/links.ts` (`VERIFY_LINK_PREFIX`, `verifyLinkFor`, `bundleFileName`), `src/ui/model/prove-flow.ts` (`startProve` with the on-page `checkBatch`, `onProveProgress`, `onProveDone`, `onProveFailed`, export helpers). Replace `screens/ctm300.ts` (limit field prefilled with `LIMIT_CENTS`, result lines, link row with prefix and length, PF5, PF9, PF10, PF11 only when `done`). Wire `update.ts`: `PROVE`, `CANCEL_PROVE`, `CLIPBOARD_WRITE`, `DOWNLOAD`, `OPEN_LINK` effects, run-id filtering, bundle dropped on edit change and on leaving CTM200.
    - Done when: `npx vitest run tests/ui -t "limit_field_prefill_and_rules|prove_success_screen|bundle_actions|verify_link_roundtrip|bundle_dropped_on_change"` passes (summary line quoted). The host-driven tests pass in 3.3.
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 3.3 Implement the effect host `createTerminal`, then Group checkpoint
    - New file `src/ui/model/terminal.ts` (`createTerminal`, `Terminal`, `TerminalDeps`): store the state before running effects, run `LOAD_SAMPLE` (with `checkSignature`), `PROVE` (rejection mapped to `ProveReason` or `UNEXPECTED` by `err instanceof ProveError && Object.hasOwn(PROVE_ERROR_MESSAGES, err.reason)`, a synchronous throw is `UNEXPECTED`), `CANCEL_PROVE`, `CLIPBOARD_WRITE`, `DOWNLOAD`, `OPEN_LINK`. Every re-entering action carries its load id or run id. No `catch` binds the thrown value, no `console.*`. `src/ui/app.tsx` is not edited here.
    - Group checkpoint: run `npm test` and `npm run typecheck`, run `git status --short`, stage by name the new and changed `src/ui` files, `tests/support/fake-prove.ts`, the new test files and `.kiro/specs/terminal-ui/tasks.md`, commit `feat(terminal-ui): prove flow and effect host`, never push, then STOP for huynh and Claude review.
    - Done when: `npm test` passes with all 3.1 tests included, `npm run typecheck` exits 0, and `git log -1 --oneline` shows the commit message (outputs quoted).
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 8.1, 8.3, 8.4, 8.5_

- [ ] 4. Group 4: React shell, scans, Playwright and production build checks
  - Needs from groups 1 to 3: `createTerminal`, `TerminalDeps`, `Terminal` (`src/ui/model/terminal.ts`), `renderGrid`, `cursorCell`, `ROWS`, `COLS` (`grid.ts`), `handleKey`, `pfAction` (`keys.ts`), `layoutOf` (`screens/index.ts`), `createSampleLoader` (`src/ui/sample-loader.ts`), `verifyLinkFor` (`links.ts`), `TerminalState`, and the existing `proveBatch`, `cancelProve` from `src/zk/prove-service.ts`. The cached Chromium (`~/Library/Caches/ms-playwright/chromium-1234`) is needed in 4.2. No task downloads a browser.
  - _Requirements: 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 4.1 Write the failing scan, theme and build-check tests
    - Under `tests/ui/` (use `stripComments` from `tests/support/strip-comments.ts`, `createElement` and `renderToStaticMarkup`, no `.tsx` test files because vitest includes `tests/**/*.test.ts` only): `ui_static_scan` (names of Requirement 9.1, `.account` read only in `screens/ctm200.ts`, `fetch(` only in `sample-loader.ts`; expected to pass at once), `ui_wording_scan` (no IBM, no 3270, no external resource URL in `index.html`), `url_holds_only_bundle` (`TerminalView` rendered with sentinel data, every `href` is the verify link), `theme_contrast` (ratios computed from `THEME`, including the scanline case, and the `prefers-reduced-motion: reduce` block and `pointer-events: none` in `terminal.css`), `dist_clean` (fixture directories always; the real `dist` case runs only when `CHECK_DIST=1`, so `npm test` needs no build), `playwright_pin` (exact `1.62.0` without `^` or `~`, no `playwright install` in `package.json`, `playwright.config.ts`, `e2e`, `scripts`).
    - Done when: `npx vitest run tests/ui -t "ui_static_scan|ui_wording_scan|url_holds_only_bundle|theme_contrast|dist_clean|playwright_pin"` fails because `src/ui/theme`, `src/ui/terminal-view` and `terminal.css` do not exist and `@playwright/test` is not pinned, with `ui_static_scan` passing at once (output quoted).
    - _Requirements: 3.5, 9.1, 9.2, 9.3, 9.4, 9.5, 10.2, 10.8_

  - [ ] 4.2 Add the pinned Playwright setup and write the e2e specs first
    - Look up the Playwright 1.62.0 config and the Vite 8 `vite preview` options first (rule 5). Run `ls ~/Library/Caches/ms-playwright` and quote it. If `chromium-1234` is missing, STOP and ask huynh; never run `playwright install`. Install with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-exact --save-dev @playwright/test@1.62.0`. Edit `package.json` (scripts `preview:e2e` = `vite preview --host 127.0.0.1 --port 4173 --strictPort`, `test:e2e` = `playwright test`; leave `build`, `test`, `test:proof` as they are) and `tsconfig.json` (`include` gains `e2e` and `playwright.config.ts`). Create `playwright.config.ts` (design section J: `webServer` `npm run build && npm run preview:e2e` on `127.0.0.1:4173`, `reuseExistingServer: false`, no COOP/COEP, `existsSync(chromium.executablePath())` check that throws `CHROMIUM NOT CACHED: STOP AND ASK`). Create `e2e/prover.spec.ts`: `context.route('**/*')` guard before navigation that aborts and records non-local origins (`e2e_local_only`, list asserted empty), then `prover_clean_to_link`, `prover_unbalanced_no_worker`, `prover_f5_no_reload`, `prover_move_cent_makes_bundle`.
    - Done when: `npx vitest run tests/ui -t playwright_pin` passes, `npm run typecheck` exits 0, and `npm run test:e2e` (timeout 600000 ms) reports the four specs failing because the shell is not wired yet, summary line quoted (outputs quoted, together with the `ls ~/Library/Caches/ms-playwright` listing and `grep -n '"@playwright/test"' package.json` showing `1.62.0`).
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 4.3 Implement the theme, the view and the React shell
    - New files: `src/ui/theme.ts` (`THEME`, `contrastRatio`, `SCANLINE_ALPHA`, palette of design section I), `src/ui/terminal.css` (layout, `@media (prefers-reduced-motion: reduce)` with `animation: none`, effect layers `pointer-events: none`), `src/ui/terminal-view.tsx` (`TerminalView({ state, onPf })`, `<pre>` rows, cursor overlay, `data-testid="pf-N"` buttons with `tabIndex={-1}` and `onMouseDown` preventDefault, `role="status"` row, `<a data-testid="verify-link">` Link_Anchor when `done`), `src/ui/browser-deps.ts` (`writeClipboard`, `download`, `openLink`). Edit `src/ui/app.tsx` (`createTerminal` once, `useSyncExternalStore`, one `document` `keydown` listener using `handleKey`, `proveBatch` and `cancelProve` as `prove`, `createSampleLoader()`), `src/main.tsx` (import `terminal.css`) and `index.html` (title `CRYPTTERM`, `color-scheme` meta). No `console.*`, no storage, no external resource.
    - Done when: `npx vitest run tests/ui` passes (summary line quoted) and `npm run typecheck` exits 0.
    - _Requirements: 8.4, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 4.4 Run the Playwright specs against the built shell
    - Run `npm run test:e2e` and fix failures in the files this group owns (never in `src/zk` or `src/ledger`). If a spec exposes a real model bug, add a regression example test and an entry in `tests/PBT-LOG.md` when a property found it.
    - Done when: `npm run test:e2e` (timeout 600000 ms) reports `4 passed`, with the `e2e_local_only` non-local origin list asserted empty and no `Executable doesn't exist` error (summary line quoted).
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_

  - [ ] 4.5 Check the production build, then Group checkpoint
    - Run `npm run build`, then `npm run check:dist-vk`, then `CHECK_DIST=1 npx vitest run tests/ui -t dist_clean`, then `npx vitest run tests/ledger -t no_private_key_in_src` (it scans `dist`), then `find dist -path '*e2e*'`. Fix failures in files this group owns.
    - Group checkpoint: run `npm test` and `npm run typecheck`, run `git status --short`, stage by name `package.json`, `package-lock.json`, `tsconfig.json`, `index.html`, `playwright.config.ts`, `src/main.tsx`, `src/ui/*` new and changed files, `e2e/prover.spec.ts`, the new test files and `.kiro/specs/terminal-ui/tasks.md`, commit `feat(terminal-ui): React shell, scans and prover e2e`, never push, then STOP for huynh and Claude review with the evidence list (each command with its summary line, `git log --oneline -5`).
    - Done when: `npm run check:dist-vk` prints `check-dist-vk: PASS` after `npm run build`, `find dist -path '*e2e*'` prints nothing, `npm test` and `npm run typecheck` pass, and `git log -1 --oneline` shows the commit message (all outputs quoted).
    - _Requirements: 9.1, 9.3, 10.7, 10.8_

## Notes

- Stop points: the end of each group checkpoint (1.3, 2.3, 3.3, 4.5); task 4.2 when `chromium-1234` is missing from the Playwright cache; and any needed change to an existing `src/zk` or `src/ledger` file, `vite.config.ts` or the vitest `include`.
- `src/ui/model/terminal.ts` runs `checkSignature`, so tests that need `signatureValid` before group 3 set it through the `SAMPLE_LOADED` action.
- The design's cancel timing example is risk 10 in `design.md` ("Cancel timing"), covered by the real-service example of task 3.1.
- `/verify` has no route yet (design risk 8). PF11 opens the link text only. CTM900 is the next spec.
- The Verify_Worker in a real browser is first exercised by the verifier spec (design risk 9). No harness page is added.
- Tasks marked `*` are not used: every test sub-task is mandatory because the groups are test-first.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0"] },
    { "id": 1, "tasks": ["1.1"] },
    { "id": 2, "tasks": ["1.2"] },
    { "id": 3, "tasks": ["1.3"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2"] },
    { "id": 6, "tasks": ["2.3"] },
    { "id": 7, "tasks": ["3.1"] },
    { "id": 8, "tasks": ["3.2"] },
    { "id": 9, "tasks": ["3.3"] },
    { "id": 10, "tasks": ["4.1"] },
    { "id": 11, "tasks": ["4.2"] },
    { "id": 12, "tasks": ["4.3"] },
    { "id": 13, "tasks": ["4.4"] },
    { "id": 14, "tasks": ["4.5"] }
  ]
}
```

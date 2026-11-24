# Implementation Plan: verifier

## Overview

CTM900 VERIFY is added to the existing block-mode terminal as one more screen of the pure state machine, in TypeScript. The plan has three groups. Each group writes its tests first (they must fail before the implementation exists), then implements until they pass, then commits by name and stops for review. Group 1 is the model and the input paths. Group 2 is the verify run and the rendering. Group 3 is the browser wiring and the Playwright spec.

Evidence rule: a task is marked completed only after its Done-when command was run in this session and its actual output is quoted in the report. Never report a hash, a file, a size or an output that this session did not produce.

Constraints that apply to every task:

- No existing file in `src/zk` or `src/ledger` changes, except for a new export, and any new export needs huynh's approval first (stop and ask). Exporting `MAX_INPUT_CHARS` from `src/zk/bundle.ts` is NOT approved: use `MAX_BUNDLE_FILE_BYTES` in `verify-flow.ts` and the `verify_file_limit_pinned` test.
- No `console.*`, network API or storage API under `src/ui` or in `src/main.tsx`. `ui_static_scan` and `ui_wording_scan` stay green.
- Property tests use `runProperty` from `tests/support/pbt.ts` with a fixed seed in the file's source (seed `202649NN` for Property NN, `NN` from 01 to 15) and at least 200 runs. Each test carries the tag `Feature: verifier, Property <n>: <text>`.
- E2E runs only against the local preview build, with the `guardLocalOnly` route guard of `e2e/prover.spec.ts` and `nonLocalOrigins` equal to `[]`. No deploy.
- Stage files by name only. Never use `git add -A` or `git add .`. Never push.

## Tasks

- [ ] 0. Commit the spec files by name
  - Stage `.kiro/specs/verifier/requirements.md`, `design.md`, `tasks.md`, `.config.kiro`, and `tasks.meta.json` only if it exists, by name. Commit with the message `docs(verifier): add verifier spec`.
  - Done when: `git log -1 --oneline` is run and its output quoted, showing the `docs(verifier): add verifier spec` commit.

- [ ] 1. Group 1: model and input paths
  - [ ] 1.1 Write the Group 1 tests (red first)
    - Create `tests/ui/verify-route-hash.prop.test.ts`: `verify_route_choice` (Property 1, plus the six path examples) and `verify_hash_source` (Property 6, plus the `#x=abc`, `#B=abc`, `#b`, `#b=` and hash-change examples, with a fake location that counts reads).
    - Create `tests/ui/verify-screen.prop.test.ts`: `verify_pf_inactive` (Property 3), `verify_pf3_navigates` (example, recording host, no `history` call), and `verify_limit_field_rules` for the prefill, the key parity with CTM300 (Property 4) and the refusal half of Property 5 (status text, cursor kept, no effect, sentinel digits in no row).
    - Create `tests/ui/verify-input.prop.test.ts`: `verify_paste_and_drop` (Property 7, with the size examples 0, 1,048,575, 1,048,576, 1,048,577, 2^53, `NaN`, `Infinity`, `-1`, `1.5`, and a fake file that records `text()` calls), the Property 8 read-order test titled `verify_single_run_and_stale_drop (Property 8 part)`, `verify_text_not_drawn` and `verify_text_held_once` (Property 9, 5 MB paste, state walk and `renderToStaticMarkup`).
    - Create `tests/ui/verify-file-limit.test.ts`: `verify_file_limit_pinned` (`MAX_BUNDLE_FILE_BYTES` is 1,048,576, and `decodeBundle` returns `TOO_LARGE` at 1,048,577 characters and not at 1,048,576).
    - Edit `tests/support/terminal-arbitraries.ts` (add `'CTM900'` to `SCREEN_IDS` and a `stateOn` case, so `screen_grid_shape`, `pf_bar_matches_handlers` and `pf_bar_buttons_match_keys` cover Property 2) and `tests/support/terminal-host.ts` (pass a recording `navigate` dep).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
    - _Properties: 1, 2, 3, 4, 5 (refusal half), 6, 7, 8, 9_
    - Done when: `npx vitest run tests/ui/verify-route-hash.prop.test.ts tests/ui/verify-screen.prop.test.ts tests/ui/verify-input.prop.test.ts tests/ui/verify-file-limit.test.ts` exits non-zero because the new modules do not exist yet, and the output is quoted.

  - [ ] 1.2 Implement the Group 1 model
    - New files: `src/ui/model/screens/ctm900.ts` (rows 1 to 8, 20, 23 and 24, PF3 BACK entry, limit field prefilled with `LIMIT_CENTS`), `src/ui/model/verify-flow.ts` (`EMPTY_VERIFY`, `MAX_BUNDLE_FILE_BYTES` with a comment naming `MAX_INPUT_CHARS` in `src/zk/bundle.ts`, `onPasteText`, `onFilesDropped`, `onFileRead`, `onFileReadFailed`, `leaveVerify`, and the refusal path of `startVerify`; an accepted limit returns the state unchanged until task 2.2 completes `startVerify`), `src/ui/model/start.ts` (`startStateFrom`, which calls `settle`).
    - Edit existing files: `src/ui/model/types.ts` (`ScreenId` gains `'CTM900'`, `BundleSource`, `DroppedFile`, `VerifyRun`, `VerifyOutcome`, `VerifyState`, `TerminalState.verify`, the actions `PASTE_TEXT`, `FILES_DROPPED`, `FILE_READ`, `FILE_READ_FAILED`, the effects `READ_FILE`, `NAVIGATE`), `src/ui/model/update.ts` (`initialState` gets `verify`, one `reduce` case per new action), `src/ui/model/terminal.ts` (`TerminalDeps.navigate`, `READ_FILE` and `NAVIGATE` effects), `src/ui/model/messages.ts` (the Group 1 texts), `src/ui/model/navigation.ts` (`goTo` takes `Exclude<ScreenId, 'CTM900'>`), `src/ui/model/prove-flow.ts` (export `limitRefused`), `src/ui/model/screens/common.ts` (`CTM900: 'VERIFY'`), `src/ui/model/screens/index.ts` (`CTM900: ctm900`), `src/ui/browser-deps.ts` (`navigate` calls `location.assign`), `src/ui/app.tsx` (pass `navigate` in the deps only). Do not edit `src/ui/terminal-view.tsx`, and do not touch `src/zk` or `src/ledger`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 6.1_
    - _Properties: 1, 2, 3, 4, 5 (refusal half), 6, 7, 8, 9_
    - Done when: `npx vitest run tests/ui && npx tsc --noEmit` exits 0, and the vitest summary line (0 failed) is quoted.

  - [ ] 1.3 Group 1 checks, commit by name, stop for review
    - Run `git diff --name-only -- src/zk src/ledger` (must print nothing) and `npx vitest run tests/ui/ui-static-scan.test.ts tests/ui/ui-wording-scan.test.ts`.
    - Stage by name: `tests/ui/verify-route-hash.prop.test.ts`, `tests/ui/verify-screen.prop.test.ts`, `tests/ui/verify-input.prop.test.ts`, `tests/ui/verify-file-limit.test.ts`, `tests/support/terminal-arbitraries.ts`, `tests/support/terminal-host.ts`, `src/ui/model/screens/ctm900.ts`, `src/ui/model/verify-flow.ts`, `src/ui/model/start.ts`, `src/ui/model/types.ts`, `src/ui/model/update.ts`, `src/ui/model/terminal.ts`, `src/ui/model/messages.ts`, `src/ui/model/navigation.ts`, `src/ui/model/prove-flow.ts`, `src/ui/model/screens/common.ts`, `src/ui/model/screens/index.ts`, `src/ui/browser-deps.ts`, `src/ui/app.tsx`, and `.kiro/specs/verifier/tasks.md` if its checkboxes changed. Commit with `feat(verifier): CTM900 model, start state and input paths`. Do not push.
    - STOP after the commit. Stop for Claude's review. Each group runs in its own fresh chat.
    - Done when: `git log -1 --oneline` is run and its output quoted, and the two checks above printed nothing and passed.

- [ ] 2. Group 2: verify run and rendering
  - [ ] 2.1 Write the Group 2 tests (red first)
    - Create `tests/support/fake-verify.ts` (records its arguments, settles on demand) and `tests/support/verify-arbitraries.ts` (malformed reports, well-formed report shapes, edit and settle interleavings, limit texts including values within 4 of `2^53`). Edit `tests/support/terminal-host.ts` to pass a `verify` dep.
    - Create `tests/ui/verify-run.test.ts`: `verify_run_start` (example, Requirement 4.1) and `verify_step_order_pinned` (`VERIFY_STEP_ORDER` equals the keys of `VERIFY_DETAILS`).
    - Create `tests/ui/verify-run.prop.test.ts`: `verify_limit_field_rules` acceptance half (Property 5, `limitCents === BigInt(text)`, called once), `verify_single_run_and_stale_drop` (Properties 10 and 11, plus the 4.3 example) and `verify_fails_closed` (Property 12, plus the four listed examples).
    - Create `tests/ui/verify-render.prop.test.ts`: `verify_steps_render` (Properties 13 and 14, seven report shapes, sentinel scan of grid and DOM text, `source_key_id` of `__proto__`, a planted bundle `circuit_version`).
    - Create `tests/ui/verify-bad-inputs.prop.test.ts`: `verify_bad_inputs` (Property 15, real `createVerifier` with an ephemeral trusted key and a stub proof check, the five examples including the 5 MB text, plus a property over arbitrary strings).
    - _Requirements: 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.4_
    - _Properties: 5 (acceptance half), 10, 11, 12, 13, 14, 15_
    - Done when: `npx vitest run tests/ui/verify-run.test.ts tests/ui/verify-run.prop.test.ts tests/ui/verify-render.prop.test.ts tests/ui/verify-bad-inputs.prop.test.ts` exits non-zero with failures in the new files only, and the output is quoted.

  - [ ] 2.2 Implement the verify run and the rendering
    - New files: `src/ui/model/source-key-id.ts` (`sourceKeyIdOf`, own-property lookup, `null` shows nothing). Extend `src/ui/model/verify-flow.ts` with `VERIFY_STEP_ORDER`, the full `startVerify`, `onVerifyDone`, `onVerifyFailed`, `normalizeReport` and `verifyShown`. Extend `src/ui/model/screens/ctm900.ts` with the six Step_Rows, the Verdict_Row, the `SOURCE KEY <id>  DEMO KEY` row and the `VERIFIER CIRCUIT <CIRCUIT_VERSION>` row.
    - Edit existing files: `src/ui/model/types.ts` (actions `VERIFY_DONE` and `VERIFY_FAILED`, effect `VERIFY`), `src/ui/model/update.ts` (the two `reduce` cases), `src/ui/model/terminal.ts` (`TerminalDeps.verify`, the `VERIFY` effect with the guarded `signatureOk` and `sourceKeyIdOf`, and no binding of a rejection value), `src/ui/model/messages.ts` (the remaining texts), `src/ui/app.tsx` (pass `verify: verifyBundle` in the deps only).
    - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
    - _Properties: 5, 10, 11, 12, 13, 14, 15_
    - Done when: `npx vitest run tests/ui && npx tsc --noEmit` exits 0, and the vitest summary line (0 failed) is quoted.

  - [ ] 2.3 Group 2 checks, commit by name, stop for review
    - Run `git diff --name-only -- src/zk src/ledger` (must print nothing) and `npx vitest run tests/ui/ui-static-scan.test.ts tests/ui/ui-wording-scan.test.ts`.
    - Stage by name: `tests/support/fake-verify.ts`, `tests/support/verify-arbitraries.ts`, `tests/support/terminal-host.ts`, `tests/ui/verify-run.test.ts`, `tests/ui/verify-run.prop.test.ts`, `tests/ui/verify-render.prop.test.ts`, `tests/ui/verify-bad-inputs.prop.test.ts`, `src/ui/model/source-key-id.ts`, `src/ui/model/verify-flow.ts`, `src/ui/model/screens/ctm900.ts`, `src/ui/model/types.ts`, `src/ui/model/update.ts`, `src/ui/model/terminal.ts`, `src/ui/model/messages.ts`, `src/ui/app.tsx`, and `.kiro/specs/verifier/tasks.md` if its checkboxes changed. Commit with `feat(verifier): verify run, fail-closed result and step rendering`. Do not push.
    - STOP after the commit. Stop for Claude's review. Each group runs in its own fresh chat.
    - Done when: `git log -1 --oneline` is run and its output quoted, and the two checks above printed nothing and passed.

- [ ] 3. Group 3: browser wiring and e2e
  - [ ] 3.1 Write the Group 3 tests (red first)
    - Create `tests/ui/browser-input.test.ts`: `verify_paste_and_drop` fake-event examples (`preventDefault` on `paste`, `dragover` and `drop` only while the screen is CTM900, a dropped `.json` file reaches `FILES_DROPPED`, the returned function removes the three listeners, no `location`, `history` or storage call).
    - Edit `tests/ui/url-holds-only-bundle.test.ts`: add CTM900 markup and a paste of a sentinel text (`url_holds_only_bundle`).
    - Create `e2e/helpers.ts` by moving `ORIGIN`, `guardLocalOnly`, `statusRow`, `gridText`, `press`, `loadSample`, `openProveScreen`, `postingRows`, `amountText` and `PROOF_WAIT_MS` out of `e2e/prover.spec.ts` (export them), and add `VERIFY_WAIT_MS`, `proveSample`, `openVerifyTab` (listener registered before the PF11 click, `context.waitForEvent('page')`, `bringToFront`), `stepsOf`, `verdictOf` and `setLimit` (Tab, 13 Backspace presses, confirm the empty field, type, confirm the field, then Enter). Edit `e2e/prover.spec.ts` to import them with no change in behavior.
    - Create `e2e/verifier.spec.ts` with `verifier_clean_verified`, `verifier_policy_500000`, `verifier_move_cent_digest_match`, `verifier_truncated_format` and `verifier_direct_visit`. Every test registers `guardLocalOnly` on the context before any navigation and ends with the `verifier_local_only` assertion `nonLocalOrigins` equal to `[]`. The two proving tests set `test.setTimeout(240_000)`.
    - _Requirements: 3.3, 3.4, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
    - Done when: `npx vitest run tests/ui/browser-input.test.ts` exits non-zero because `src/ui/browser-input.ts` does not exist, and `npx playwright test --list` is run and its output quoted, listing the five verifier tests and all prover tests.

  - [ ] 3.2 Wire the browser and make the e2e pass
    - New file: `src/ui/browser-input.ts` (`installBundleInput` with the `paste`, `dragover` and `drop` listeners, active only while `getState().screen === 'CTM900'`, returns the remover). Edit `src/main.tsx` (call `startStateFrom(location)` once, pass the result as `start`) and `src/ui/app.tsx` (accept the `start` prop, pass it to `createTerminal`, call `installBundleInput(document, terminal)` in the existing layout effect). Do not edit `src/ui/terminal-view.tsx`.
    - Build and run the suites against the local preview build only: no deploy, no `netlify` command.
    - _Requirements: 1.1, 3.1, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
    - Done when: `npm run build && npx vitest run && npm run test:e2e` exits 0, and the vitest and Playwright summary lines (0 failed) are quoted.

  - [ ] 3.3 Group 3 checks, commit by name, stop for review
    - Run `git diff --name-only -- src/zk src/ledger` (must print nothing), `npx vitest run tests/ui/ui-static-scan.test.ts tests/ui/ui-wording-scan.test.ts tests/ui/url-holds-only-bundle.test.ts`, and `git status --short` to confirm that only the listed files changed.
    - Stage by name: `src/ui/browser-input.ts`, `src/main.tsx`, `src/ui/app.tsx`, `tests/ui/browser-input.test.ts`, `tests/ui/url-holds-only-bundle.test.ts`, `e2e/helpers.ts`, `e2e/prover.spec.ts`, `e2e/verifier.spec.ts`, and `.kiro/specs/verifier/tasks.md` if its checkboxes changed. Commit with `feat(verifier): CTM900 browser wiring and e2e`. Do not push.
    - STOP after the commit. Stop for Claude's review. Each group runs in its own fresh chat.
    - Done when: `git log -1 --oneline` is run and its output quoted, and the three checks above printed nothing unexpected and passed.

## Notes

- Test sub-tasks are required here, not optional: each group's tests are written first and must fail before its implementation exists.
- Every sub-task names the requirements and design properties it covers, so each acceptance criterion traces to a test.
- Property 2 is covered by extending the existing screen-shape and PF-bar properties through `tests/support/terminal-arbitraries.ts`.
- Requirement 6.5 is checked in each group's commit task with `git diff --name-only -- src/zk src/ledger`, which must print nothing.

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
    { "id": 9, "tasks": ["3.3"] }
  ]
}
```

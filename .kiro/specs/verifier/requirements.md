# Requirements Document

## Introduction

`verifier` is the second half of the demo: the CTM900 VERIFY screen, a screen of the existing block-mode terminal that runs on its own route `/verify`. It reads a proof bundle from the `#b=` fragment of the Verify_Link (the PF11 link of CTM300), from a paste anywhere on the page, or from a dropped `.json` file. On Enter it runs `verifyBundle(text, { limitCents })` against the verifier's own policy limit, and shows the six steps `FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY`, `CIRCUIT` and `PROOF`, then `VERIFIED` or `REJECTED AT <STEP>`. The bundle text is never drawn on the grid.

Reuse, not duplication. From `src/zk`: `verifyBundle`, `createVerifier` (for test doubles), `VerifyReport`, `VerifyStep`, `VerifyStepName`, `VERIFY_DETAILS`, `decodeBundle` and `CIRCUIT_VERSION`. From `src/ledger`: `LIMIT_CENTS` and `TRUSTED_SOURCE_KEYS`. From `src/ui/model`: the screen model (`ScreenDef`, `Field`, `PfEntry`, `Effect`, `update`, `createTerminal`), `renderGrid`, `parseAmountInput` with `AMOUNT_INPUT_MESSAGES`, `handleKey` and `pfAction`, `MESSAGES`, the run-id drop pattern of `prove-flow.ts` (`isCurrentRun`), and `VERIFY_LINK_PREFIX` in `links.ts`. The terminal-ui spec produces the link and this spec reads it. These names were checked against the code.

Constraints that apply to every requirement:

- CTM900 is a screen of the same terminal model and the same React shell, chosen by `location.pathname === '/verify'`. `public/_redirects` already holds the SPA fallback, so a direct visit or a refresh of `/verify` loads the app.
- No existing file in `src/zk` or `src/ledger` changes, except for new exports. If any other change is needed, work stops and huynh is asked. Changes to existing `src/ui` files are allowed where CTM900 plugs in, and the design lists each one.
- The model is pure TypeScript with no React, no DOM and no network, and tests drive it in Node with an injected `verifyBundle`.
- Amounts are `bigint` cents. No `Number`, `parseFloat` or `parseInt` on an amount.
- Terminal copy is uppercase, terse and operational, and says "block-mode terminal". Third-party trademark names appear nowhere.
- No new runtime dependency.
- Property tests use fast-check with a fixed, logged seed (`tests/support/pbt.ts`, `runProperty`) and at least 200 runs unless stated otherwise.
- A task is marked completed only after its "Done when" check has run in the session and the report quotes the command and its output.

## Glossary

- **Terminal_Model**: The pure state machine in `src/ui/model`. It takes key events and system actions and returns a new state and effects.
- **Verify_Screen**: The CTM900 screen of the Terminal_Model, titled `CTM900  VERIFY`.
- **Screen_Grid**: The 80-column by 24-row character grid. Row 23 is the PF_Bar and row 24 is the Status_Line.
- **Status_Line**: Row 24 of the Screen_Grid.
- **PF_Bar**: The row of PF key labels, with one on-screen button per label.
- **Amount_Input**: `parseAmountInput` and `AMOUNT_INPUT_MESSAGES` in `src/ui/model/amount-input.ts`. It accepts 1 to 13 digits, no leading zero unless the text is `0`, and a value below `2^40`.
- **Limit_Field**: The one input Field of the Verify_Screen, labelled `POLICY LIMIT (CENTS)`.
- **Verifier**: `verifyBundle` in `src/zk/verifier.ts`. It resolves for every input and never throws.
- **Verify_Report**: The `VerifyReport` that the Verifier returns: a `verdict` and the `steps` that ran, up to and including the first failed step.
- **Bundle_Text**: The text that the Verifier receives. It is held in the Terminal_Model state in exactly one field.
- **Bundle_Source**: Where the Bundle_Text came from: `LINK`, `PASTE`, `FILE`, or `NONE` when no bundle was supplied.
- **Verify_Link**: The text `/verify#b=` (`VERIFY_LINK_PREFIX`) followed by the base64url bundle.
- **Verify_Input**: The pair of the Bundle_Text and the Limit_Field text. A change to either after a run has started makes that run stale.
- **Verify_Run**: One call of the Verifier started by Enter. It has a run id that never repeats.
- **Step_Row**: A body row of the Verify_Screen for one of the six steps, in the form `<STEP>  OK|FAIL|NOT RUN  <detail>`.
- **Verdict_Row**: The body row that holds `VERIFIED` or `REJECTED AT <STEP>`.
- **Demo_Key_Label**: The text `DEMO KEY` that marks the source key id as a demo key.
- **Verify_E2E**: The Playwright spec `e2e/verifier.spec.ts`.
- **Local_Guard**: The request guard of `e2e/prover.spec.ts` (`guardLocalOnly`) that aborts and records every request whose origin is not the preview server, `blob:` or `data:`.

## Requirements

### Requirement 1: The CTM900 route and screen shell

**User Story:** As a verifier with no access to raw data, I want a verify screen on its own URL, so that I can open a shared link or refresh the page and land on the same screen.

#### Acceptance Criteria

1. WHEN the app starts with `location.pathname` equal to `/verify`, THE Terminal_Model SHALL start on the Verify_Screen, and WHEN the pathname is anything else, THE Terminal_Model SHALL start on CTM000 (test: `verify_route_choice`, example over `/`, `/verify`, `/verify/`, `/verifyx`, `/VERIFY` and `/verify/x`)
2. THE Verify_Screen SHALL render exactly 24 rows of exactly 80 characters, with the title row `CTM900  VERIFY`, the label `DEMO DATA`, the PF_Bar on row 23 and the Status_Line on row 24 (test: `screen_grid_shape`, the existing property extended to CTM900)
3. THE PF_Bar of the Verify_Screen SHALL list PF3 with the label BACK and no other PF key, and the on-screen PF3 button SHALL do the same as the F3 key (test: `pf_bar_matches_handlers` and `pf_bar_buttons_match_keys`, the existing properties extended to CTM900)
4. WHEN PF3 is pressed on the Verify_Screen, THE Terminal_Model SHALL return one effect that navigates to `/` by a plain page navigation, and SHALL change no other part of the state (test: `verify_pf3_navigates`, example with a recording host and a check that no `history` call is made)
5. WHEN a PF key that the Verify_Screen does not list is pressed, THE Terminal_Model SHALL write the fixed text `PF KEY NOT ACTIVE` to the Status_Line and return no effect (test: `verify_pf_inactive`, property over PF1 to PF12 except PF3)

### Requirement 2: Policy limit field

**User Story:** As a verifier, I want the policy limit to be mine and to default to the standard one, so that a prover cannot choose the limit that is checked against.

#### Acceptance Criteria

1. THE Verify_Screen SHALL show the Limit_Field prefilled with the decimal text of `LIMIT_CENTS`, with the cursor in it (test: `verify_limit_field_rules`, example)
2. THE Limit_Field SHALL accept digits typed and deleted with the same keys as the CTM300 limit field, and no other character (test: `verify_limit_field_rules`, property over key sequences, compared with the CTM300 behavior)
3. WHEN Enter is pressed and the Limit_Field text is accepted by the Amount_Input, THE Terminal_Model SHALL use the `bigint` value of the text, built from the digits without any `Number` step, as `limitCents` of the run (test: `verify_limit_field_rules`, property over valid texts with a fake Verifier that records its second argument and compares it with `BigInt(text)`)
4. IF the Limit_Field text is empty, holds a sign, a decimal point, an exponent, whitespace or a non-digit, has a leading zero before another digit, has 14 or more digits, or has a value of `2^40` or more, THEN THE Terminal_Model SHALL write the matching `AMOUNT_INPUT_MESSAGES` text to the Status_Line, keep the cursor in the Limit_Field, and call the Verifier zero times (test: `verify_limit_field_rules`, property over generated invalid texts plus the examples `0`, `1099511627775`, `1099511627776` and the values within 4 of `2^53`)
5. THE messages of the Limit_Field SHALL contain no part of the typed text (test: `verify_limit_field_rules`, which plants sentinel digits in a rejected text and scans every row)

### Requirement 3: Bundle sources and input hygiene

**User Story:** As a verifier, I want to open a bundle from a link, a paste or a dropped file, so that I can check a proof however it reached me, without the bundle text appearing on the screen.

#### Acceptance Criteria

1. WHEN the page loads, THE Verify_Screen host SHALL read `location.hash` once, and IF the fragment starts with `#b=` and holds at least one character after it, THEN THE Terminal_Model SHALL take the text after `#b=` as the Bundle_Text with Bundle_Source `LINK` (test: `verify_hash_source`, property over generated fragments, with a fake location that counts reads)
2. IF the fragment is empty, is `#b=` alone, or starts with anything other than `#b=`, THEN THE Terminal_Model SHALL keep Bundle_Source `NONE`, and a change of the fragment after the page load SHALL not change the Bundle_Text (test: `verify_hash_source`, example over `#x=abc`, `#B=abc`, `#b`, `#b=` and a hash change after load)
3. WHEN a paste event with non-empty `text/plain` data arrives anywhere on the page while the Verify_Screen is shown, THE Terminal_Model SHALL replace the Bundle_Text with that text and set Bundle_Source `PASTE`, and the host SHALL cancel the browser's default paste action (test: `verify_paste_and_drop`, example with fake events)
4. WHEN exactly one file whose name ends in `.json`, in any letter case, is dropped on the page, THE host SHALL read its text, and THE Terminal_Model SHALL replace the Bundle_Text with it and set Bundle_Source `FILE`, and the host SHALL cancel the default drag and drop action so that the browser does not open the file (test: `verify_paste_and_drop`, example with a fake file)
5. IF a drop holds no file, more than one file, or a file whose name does not end in `.json`, THEN THE Terminal_Model SHALL keep the Bundle_Text and write the fixed text `DROP ONE .JSON FILE` to the Status_Line (test: `verify_paste_and_drop`, example per case)
6. WHEN a file read is pending and a newer paste or drop arrives, THE Terminal_Model SHALL drop the result of the older read, so that the newest source is the one held (test: `verify_single_run_and_stale_drop`, property over the settle order of two reads)
7. THE Verify_Screen SHALL show the Bundle_Source and the length of the Bundle_Text in characters, and no part of the Bundle_Text SHALL appear in any grid row, the Status_Line or any rendered DOM text (test: `verify_text_not_drawn`, which pastes a 5 MB text that holds a sentinel and scans the grid and the DOM text of the view)
8. THE Terminal_Model SHALL hold the Bundle_Text in exactly one state field and SHALL build no second copy of it, and its only use SHALL be the argument of the Verifier call (test: `verify_text_held_once`, which walks the whole state after a 5 MB paste and counts string values longer than 1,000 characters, which must be at most 1)

### Requirement 4: Run control

**User Story:** As a verifier, I want one clear run per Enter and no result for an input I have already changed, so that the verdict on the screen always belongs to the bundle and limit on the screen.

#### Acceptance Criteria

1. WHEN Enter is pressed and the Limit_Field text is accepted, THE Terminal_Model SHALL return one effect that calls `verifyBundle(text, { limitCents })` with the Bundle_Text (the empty text when Bundle_Source is `NONE`) and the parsed limit, SHALL write the fixed text `VERIFYING` to the Status_Line, and SHALL clear any earlier Verify_Report from the screen (test: `verify_run_start`, example with a fake Verifier that records its arguments)
2. WHILE a Verify_Run is active, THE Terminal_Model SHALL answer Enter with the Status_Line text `VERIFY IN PROGRESS` and SHALL start no second call (test: `verify_single_run_and_stale_drop`, property over Enter press counts, which asserts exactly one call of the fake Verifier)
3. WHEN the Verifier resolves for the active Verify_Run and the Verify_Input is unchanged since the run started, THE Terminal_Model SHALL store the Verify_Report, end the run, and accept Enter again (test: `verify_single_run_and_stale_drop`, example)
4. IF the Verify_Input changed while a Verify_Run was active, or the result carries a run id that is not the active one, THEN THE Terminal_Model SHALL drop the result, show no Verify_Report, end the run, and write the fixed text `INPUT CHANGED, PRESS ENTER` to the Status_Line, and WHILE the older run is still unsettled the screen SHALL keep answering Enter with `VERIFY IN PROGRESS` (test: `verify_single_run_and_stale_drop`, property over the order of edits to the bundle and the limit, and of settles, which asserts that no stale report is ever shown)
5. IF the Verifier rejects, or resolves with a value that is not a Verify_Report with a `verdict` of `VERIFIED` or `REJECTED` and a non-empty `steps` array, or a `verdict` of `VERIFIED` that does not hold six passing steps in the fixed order, THEN THE Terminal_Model SHALL write the fixed text `REJECTED: VERIFIER ERROR` to the Verdict_Row and the Status_Line, and SHALL never show `VERIFIED` (test: `verify_fails_closed`, example over a rejecting fake, a `null` result, an empty `steps` array, and a `VERIFIED` verdict with five steps)

### Requirement 5: Result display

**User Story:** As a verifier, I want each of the six steps shown with its outcome and the first failing step named, so that I can see exactly why a bundle was rejected, and I want a bad input to end in a named rejection and never in a crash.

#### Acceptance Criteria

1. WHEN a Verify_Report is stored, THE Verify_Screen SHALL show one Step_Row for each of `FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY`, `CIRCUIT` and `PROOF`, in this order, with `OK` or `FAIL` and the text of `VERIFY_DETAILS` for that step and outcome for each step that ran, and `NOT RUN` for each step after the first failed step (test: `verify_steps_render`, property over the seven report shapes: a first failure at each of the six steps, and all six passing)
2. THE Verdict_Row SHALL show `VERIFIED` only when all six steps are `OK`, and otherwise `REJECTED AT <STEP>` with the name of the first failed step (test: `verify_steps_render`, same property)
3. THE word `VERIFIED` SHALL appear on the Verify_Screen only in the Verdict_Row of a stored report whose six steps are all `OK`, and in no other row, no Status_Line text and no other state (test: `verify_steps_render`, which scans the grid before any run, while running, after a stale drop, after a failure and after a pass)
4. WHEN the `SIGNATURE` step is `OK`, THE Verify_Screen SHALL show the source key id followed by the Demo_Key_Label, and the id SHALL be the one from `TRUSTED_SOURCE_KEYS` that was found by own-property lookup, and WHEN the `SIGNATURE` step failed or did not run, THE Verify_Screen SHALL show no source key id (test: `verify_steps_render`, which includes a bundle whose `source_key_id` is `__proto__`)
5. THE Verify_Screen SHALL show the `CIRCUIT_VERSION` of the verifier, labelled as the verifier's circuit, and SHALL show no `circuit_version` from a bundle (test: `verify_steps_render`, which plants a different `circuit_version` in the bundle)
6. THE Verify_Screen SHALL echo nothing from a bundle other than what the two rules above allow, so that for every report shape, a sentinel planted in each text field of the bundle appears in no grid row, no Status_Line text and no DOM text (test: `verify_steps_render`, sentinel scan)
7. WHEN the Bundle_Text is empty, is random text, is a valid bundle cut short, is a signed bundle with a wrong `circuit_version`, or is a text of 5 MB, THE Terminal_Model SHALL end the run with the verdict `REJECTED`, naming `FORMAT` for the first, second, third and fifth, and `CIRCUIT` for the fourth, and SHALL not throw (test: `verify_bad_inputs`, examples that use `createVerifier` with an ephemeral trusted key and a stub proof check as the injected Verifier, plus a property over arbitrary strings that asserts a `REJECTED AT FORMAT` verdict and no `VERIFIED`)

### Requirement 6: Privacy and wording

**User Story:** As a security reviewer, I want the verify path to keep the bundle in memory and off the network, so that the verifier adds no data path that the prover side does not have.

#### Acceptance Criteria

1. THE sources under `src/ui` and `src/main.tsx`, including the CTM900 files and the host code for paste, drop and the hash, SHALL contain no `console.*` call, no `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `importScripts`, no `localStorage`, `sessionStorage`, `indexedDB`, `caches` or `document.cookie`, no `parseFloat` or `parseInt`, no `dangerouslySetInnerHTML` and no `Number(` call on an amount (test: `ui_static_scan`, the existing scan, which already covers every file under `src/ui`)
2. THE verify path SHALL cause no network request other than the same-origin assets that the existing Verify_Worker loads, and the app SHALL load nothing from another origin (test: `verifier_local_only`, which is the `nonLocalOrigins` assertion of Requirement 7)
3. WHEN a bundle is pasted, dropped or loaded from the fragment, THE app SHALL not write the Bundle_Text to the URL, to `history`, or to any storage, and the fragment that arrived SHALL be left as it was (test: `url_holds_only_bundle`, the existing test extended with a paste of a sentinel text, which asserts that `location`, `history` calls and storage are unchanged)
4. THE app, the docs and the terminal copy SHALL name the key id as a demo key wherever it is shown, and SHALL contain no third-party trademark name (test: `ui_wording_scan`, the existing scan, and `verify_steps_render` for the Demo_Key_Label)
5. THE number of files that change in `src/zk` and `src/ledger` SHALL be zero, except for added exports (test: Done-when check, `git diff --name-only -- src/zk src/ledger` and a read of each listed diff)

### Requirement 7: Browser checks on the built app

**User Story:** As huynh, I want the verify half of the demo run in a real browser against the production build, so that the judge path and both tamper cases are proven end to end.

#### Acceptance Criteria

1. THE Verify_E2E SHALL run only against the `npm run build` output served by `vite preview` on `127.0.0.1` with `--strictPort`, SHALL use the Local_Guard on every test, and SHALL assert in every test that the list of non-local origins is empty (test: `verifier_local_only`, in `e2e/verifier.spec.ts`)
2. WHEN the clean sample has been proved in the prover and the Verify_Link has been opened through PF11, THE Verify_E2E SHALL press Enter on the Verify_Screen and see six `OK` Step_Rows and the Verdict_Row `VERIFIED`, with a run time that fits the real single-threaded proof check (test: `verifier_clean_verified`, in `e2e/verifier.spec.ts`)
3. WHEN the same Verify_Link is opened and the Limit_Field is changed to `500000`, THE Verify_E2E SHALL see the Verdict_Row `REJECTED AT POLICY`, with `FORMAT`, `SIGNATURE` and `DIGEST_MATCH` as `OK`, `POLICY` as `FAIL`, and `CIRCUIT` and `PROOF` as `NOT RUN` (test: `verifier_policy_500000`, in `e2e/verifier.spec.ts`)
4. WHEN the clean sample is edited by moving 1 cent between two postings, proved, and its Verify_Link is opened, THE Verify_E2E SHALL see the Verdict_Row `REJECTED AT DIGEST_MATCH`, with `FORMAT` and `SIGNATURE` as `OK` (test: `verifier_move_cent_digest_match`, in `e2e/verifier.spec.ts`, which is the case of the video)
5. WHEN the page opens at `/verify#b=` followed by a cut-short bundle and Enter is pressed, THE Verify_E2E SHALL see the Verdict_Row `REJECTED AT FORMAT` and five `NOT RUN` Step_Rows (test: `verifier_truncated_format`, in `e2e/verifier.spec.ts`)
6. WHEN the Verify_E2E loads `/verify` by a direct visit, THE app SHALL serve the Verify_Screen, so that the SPA fallback works for a shared link (test: `verifier_direct_visit`, in `e2e/verifier.spec.ts`, which also asserts `NONE` as the Bundle_Source and no `VERIFIED` text)

## Decisions and notes for review

1. **Enter is required (3.1, 4.1).** A bundle that arrives by link, paste or drop is not verified until Enter is pressed. The screen shows the source and the length first, and the run starts on Enter. This matches the product description of CTM900 and keeps the limit change in Requirement 7.3 possible before the run.
2. **Enter with no bundle (4.1, 5.7).** The Verifier is called with the empty text and reports `REJECTED AT FORMAT`, so there is one code path and no extra "no bundle" message.
3. **Oversize input (3.8, 5.7).** The 1 MB limit stays inside the Verifier (`decodeBundle` returns `TOO_LARGE`, which the Verifier reports as a failed `FORMAT`). The UI adds no second limit. Its duty is to hold the text once and never draw it.
4. **What is shown from a bundle (5.4 to 5.6).** Only the source key id appears, and only after `SIGNATURE` passed, taken from the trusted table by own-property lookup. The circuit version shown is the verifier's own `CIRCUIT_VERSION`, not the bundle's, because the product rule is that nothing from a rejected bundle is echoed. A wrong `circuit_version` is reported by the `CIRCUIT` step and its fixed detail.
5. **Stale runs (4.4).** `verifyBundle` has no cancel call. A change to the bundle or the limit during a run therefore marks the run stale and the screen waits for it to settle before it accepts another Enter, which keeps "one run at a time". The stale result is dropped, using the same run-id pattern as `isCurrentRun` in `prove-flow.ts`.
6. **Fail closed in the model (4.5).** `verifyBundle` never throws, but the model also refuses any result that is not a well-formed report, because `security.md` requires that `VERIFIED` appears only when every step passed.
7. **The fragment is public by design.** The `b` fragment holds only the public bundle, so reading it is not a privacy event. The app never writes it back (6.3).
8. **Video case (7.4).** The prover signs the bundle with the signed root and the proof carries the edited root as its public input, so a 1-cent move that keeps the batch balanced fails at `DIGEST_MATCH` with `SIGNATURE` still `OK`.
9. **Expected edits outside the new files.** `src/ui/app.tsx` and `src/main.tsx` (route choice, paste, drop and hash host), `src/ui/model/types.ts` and `src/ui/model/screens/index.ts` (the screen id and its definition), `src/ui/model/terminal.ts` and `src/ui/model/update.ts` (the verify effect, the navigate effect and the system actions), `src/ui/model/screens/common.ts` (the screen name), `src/ui/model/messages.ts` (fixed texts) and `src/ui/terminal-view.tsx` (the screen id in the view). The design lists the exact changes. No file in `src/zk` or `src/ledger` is expected to change.

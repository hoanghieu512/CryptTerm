# Requirements Document

## Introduction

`terminal-ui` is the prover side of CryptTerm: a green-screen, block-mode terminal with four screens. CTM000 LOGON, CTM100 BATCH SELECT, CTM200 BATCH VIEW (with tamper mode) and CTM300 PROVE. The terminal loads a signed sample, shows its postings with masked accounts, lets the operator edit amounts to demonstrate tampering, and calls the existing prove service. It ends with a proof bundle that the operator can copy, download, or open through the link `/verify#b=<encodeBundleForUrl(bundle)>`. CTM900 and the `/verify` route are the next spec. This spec only produces the link.

Reuse, not duplication. From `src/ledger`: `parseBatch`, `Batch`, `Posting`, `checkBatch`, `CheckReason`, `checkInvariants`, `verifyDigest`, `SignedDigest`, `isSignedDigestShape`, `TRUSTED_SOURCE_KEYS`, `LIMIT_CENTS`, `AMOUNT_BOUND_CENTS` and the column widths in `layout.ts`. From `src/zk`: `proveBatch`, `cancelProve`, the `ProveService` interface (for the test double), `ProveError`, `PROVE_ERROR_MESSAGES`, `PROVE_STAGES`, `encodeBundleForUrl`, `bundleToJson`, `decodeBundle` and `ProofBundle`. These names were checked against the code. The model works through the `ProveService` interface and not through the `proveBatch` function directly, so tests inject a fake. `src/ledger` has no account-masking helper, so masking is added there as a new file, `src/ledger/mask.ts`, which `structure.md` assigns to `src/ledger`. The sample files are `public/samples/{clean,over-limit-unflagged,unbalanced,large}.dat` with a matching `.digest.json`.

Constraints that apply to every requirement:

- New code lives under `src/ui` (the model in `src/ui/model`, React in `src/ui`), the new file `src/ledger/mask.ts`, and the build and test files named in Requirement 10. No existing file in `src/zk` or `src/ledger` changes, with two allowances: the new file `src/ledger/mask.ts`, and new exports. If any other change is needed, work stops and huynh is asked. The spike files stay untouched (their removal is Task 7).
- The model is pure TypeScript with no React, no DOM and no network, and tests drive it in Node. Dependency direction stays `ui -> zk -> ledger`.
- Amounts are `bigint` cents. No `Number`, `parseFloat` or `parseInt` on an amount, and amounts are formatted with string handling and integer arithmetic only.
- Terminal copy is uppercase, terse and operational, and says "block-mode terminal". The words "IBM" and "3270" appear nowhere.
- No new runtime dependency. `@playwright/test` is a dev dependency pinned at 1.62.0.
- Property tests use fast-check with a fixed, logged seed (`tests/support/pbt.ts`, `runProperty`) and at least 200 runs unless stated otherwise.
- A task is marked completed only after its "Done when" check has run in the session and the report quotes the command and its output (`structure.md`, "Evidence before status").

## Glossary

- **Terminal_Model**: The pure state machine in `src/ui/model`. It holds the current screen, fields, cursor, status line, loaded batch and prove state, and it takes key events and returns effects.
- **Screen_Grid**: The 80-column by 24-row character grid that the Terminal_Model renders for each screen. Row 24 is the Status_Line. The PF_Bar sits on row 23.
- **Field**: A run of cells on the Screen_Grid. A protected Field takes no input. An unprotected Field is an input Field.
- **Status_Line**: Row 24 of the Screen_Grid.
- **PF_Bar**: The always-visible row of PF key labels, with one on-screen button per label in the React view.
- **PF_Key**: One of PF1 to PF12. PF1 to PF10 have a physical binding (F1 to F10) and an Alt_Binding. PF11 and PF12 have only the Alt_Binding and the PF_Bar button, because F11 and F12 stay with the browser (full screen and developer tools).
- **Alt_Binding**: The alternate for a PF_Key, matched on `KeyboardEvent.code`: Alt+`Digit1` to Alt+`Digit9` for PF1 to PF9, Alt+`Digit0` for PF10, Alt+`Minus` for PF11 and Alt+`Equal` for PF12.
- **Key_Handler**: The function that maps a key event to a Terminal_Model action and reports whether `preventDefault` is required. It takes the key event only and no screen id. It returns no action and no `preventDefault` for F11 and F12.
- **Sample_Loader**: The function that fetches a sample's `.dat` and `.digest.json` from the app's own origin through an injected fetch function, and returns a `Batch` and a `SignedDigest`.
- **Mask_Function**: The pure function exported from `src/ledger/mask.ts` (no DOM, no React, no network) that renders an account as 16 mask characters followed by the last 4 digits of the account's zero-padded 20-digit decimal form.
- **Amount_Input**: The parser for a typed amount or limit. It accepts 1 to 13 digits, no leading zero unless the whole text is `0`, and a value below `AMOUNT_BOUND_CENTS`, and it returns a `bigint` or a fixed field message.
- **Tamper_Mode**: The CTM200 mode, toggled by PF12, in which one amount at a time can be edited in place.
- **Working_Batch**: The `Batch` that CTM200 and CTM300 use. It starts equal to the loaded batch and changes only through Tamper_Mode edits.
- **Original_Digest**: The `SignedDigest` loaded with the sample. It never changes during a session.
- **Prove_Port**: The `ProveService` interface (`proveBatch`, `cancelProve`) that the Terminal_Model calls. The browser build passes the real service and tests pass a fake.
- **Verify_Link**: The text `/verify#b=` followed by `encodeBundleForUrl(bundle)`. It is about 27,000 characters long, so the Screen_Grid shows only its prefix and its length, and the full link is an `<a>` element (the Link_Anchor) placed on the page under the grid.
- **Link_Anchor**: The `<a>` element under the Screen_Grid whose `href` and text are the full Verify_Link.
- **Prover_E2E**: The Playwright spec `e2e/prover.spec.ts`.

## Requirements

### Requirement 1: Block-mode screen model

**User Story:** As a prover, I want a fixed 80x24 screen with fields, a status line and a PF key bar, so that the app works like a block-mode terminal and tests can drive it without a browser.

#### Acceptance Criteria

1. THE Terminal_Model SHALL render every screen as exactly 24 rows of exactly 80 characters, with the Status_Line on row 24 and the PF_Bar on row 23 (test: `screen_grid_shape`, property over all screens and reachable states)
2. WHEN Tab is pressed, THE Terminal_Model SHALL move the cursor to the next unprotected Field, and WHEN Shift+Tab is pressed, THE Terminal_Model SHALL move it to the previous one, wrapping at both ends (test: `tab_order`, property over screens and press counts)
3. WHEN a printable key is pressed while the cursor is in an unprotected Field, THE Terminal_Model SHALL write that character into the Field and SHALL ignore the key in a protected cell (test: `field_input_protected`)
4. WHEN Enter is pressed, THE Terminal_Model SHALL submit the whole screen, which means the action of the current screen receives the values of all its input Fields at once (test: `enter_submits_whole_screen`)
5. THE PF_Bar SHALL list only the PF_Keys that the current screen handles, each with its label and its PF number (test: `pf_bar_matches_handlers`, property over screens)

### Requirement 2: Key mapping and screen flow

**User Story:** As a prover on a Mac laptop, I want PF1 to PF10 on F1 to F10, and PF11 and PF12 on Alt keys or the on-screen bar, so that PF5 never reloads the page and the browser keeps F11 (full screen) and F12 (developer tools) for judges who check the no-network claim.

#### Acceptance Criteria

1. WHEN a key event with `key` F1 to F10 is handled, THE Key_Handler SHALL map it to PF1 to PF10 and SHALL report `preventDefault` as required, whether or not the current screen handles that PF_Key (test: `pf5_does_not_reload`, which asserts for F5 on CTM300 that `preventDefault` is reported and that proving starts, plus a property over F1 to F10 on every screen)
2. WHEN a key event has `altKey` true, no `ctrlKey`, no `metaKey` and a `code` listed in the Alt_Binding definition, THE Key_Handler SHALL map it to the matching PF_Key by `code`, covering all 12 PF_Keys including PF11 through Alt+`Minus` and PF12 through Alt+`Equal`, and SHALL report `preventDefault` as required, even when `key` holds an Option-modified character such as `¡` (test: `alt_bindings_work`, which covers all 12 bindings with macOS-style `key` values)
3. WHEN a key event with `key` F11 or F12 and no Alt_Binding match is handled, THE Key_Handler SHALL return no action and SHALL not report `preventDefault`, on every screen and in every Terminal_Model state, so that the browser keeps full screen and developer tools (test: `f11_f12_not_handled`, property over screens and modifier combinations other than the Alt_Binding)
4. WHEN a PF_Bar button is activated, THE Terminal_Model SHALL perform the same action as the matching key event, including for PF11 and PF12 (test: `pf_bar_buttons_match_keys`, property over screens and PF_Keys)
5. THE Terminal_Model SHALL move only along CTM000 to CTM100 to CTM200 to CTM300 on Enter or the screen's forward key, and SHALL move back one screen on PF3 (test: `screen_flow`, property over random key sequences, which asserts that the screen is always one of the four and that PF3 on CTM000 leaves the screen unchanged)
6. WHEN a screen is left through PF3, THE Terminal_Model SHALL keep the loaded sample and the Working_Batch while going from CTM300 to CTM200, and SHALL discard them while going from CTM200 to CTM100 (test: `screen_flow`)

### Requirement 3: Load a signed sample (CTM000 and CTM100)

**User Story:** As a judge, I want to press Enter at the logon screen and pick a sample, so that I reach a signed batch in two keystrokes with nothing to install or upload.

#### Acceptance Criteria

1. THE CTM000 screen SHALL show the title, the label DEMO, and the text PRESS ENTER, and Enter SHALL lead to CTM100 with no credential (test: `logon_to_select`)
2. THE CTM100 screen SHALL list exactly the four samples `clean`, `over-limit-unflagged`, `unbalanced` and `large`, each with a selection number, and a Field for the selection number (test: `batch_select_lists_samples`)
3. WHEN a valid selection is submitted, THE Sample_Loader SHALL request only `/samples/<name>.dat` and `/samples/<name>.digest.json`, parse the first with `parseBatch`, check the second with `isSignedDigestShape`, and THE Terminal_Model SHALL go to CTM200 with the Working_Batch and the Original_Digest (test: `sample_load`, example over all four samples with a fake fetch that serves the committed files)
4. IF the selection is empty, is not a listed number, the fetch fails, the text fails `parseBatch`, or the digest fails the shape check, THEN THE Terminal_Model SHALL stay on CTM100 and write a fixed uppercase message to the Status_Line that holds no batch text and no thrown message (test: `sample_load_failure`, example per defect with sentinel text planted in the served files and absent from the message)
5. THE Sample_Loader SHALL be the only code under `src/ui` that calls `fetch`, and the request URLs SHALL be relative to the app origin (test: `ui_static_scan`)

### Requirement 4: CTM200 batch view

**User Story:** As a prover, I want to page through postings with masked accounts, totals and the digest status, so that I can see what I am about to prove without exposing account numbers.

#### Acceptance Criteria

1. THE Mask_Function SHALL return, for every account, text of exactly 20 characters that shows exactly the last 4 digits of the zero-padded 20-digit decimal form after 16 mask characters, including for accounts below 10,000, whose leading zeros stay hidden (test: `mask_account` in `tests/ledger/mask.prop.test.ts`, property over accounts in the range of the `Posting` account type, plus examples for `0`, `7`, `9999`, `10000` and the largest account)
2. THE Mask_Function SHALL be the only way an account is rendered, and no rendered screen text of any state SHALL contain the zero-padded 20-digit form of an account, or its decimal form when that has more than 4 digits (test: `masked_accounts`, which renders every page of all four samples, before and after tamper edits)
3. WHEN PF7 or PF8 is pressed, THE Terminal_Model SHALL move to the previous or next page, and the pages together SHALL show every posting of the Working_Batch exactly once, in slot order, with PF7 on the first page and PF8 on the last page leaving the page unchanged (test: `paging_covers_all_postings`, property over batches of 1 to 64 postings)
4. THE CTM200 screen SHALL show the debit total and the credit total of the Working_Batch as `bigint` cents formatted by integer and string handling (test: `totals_match_invariants`, property comparing the displayed totals with a separate `bigint` sum, plus `format_cents_roundtrip`, property that the formatted text of any amount in `[0, 2^40)` converts back to the same `bigint`)
5. WHEN CTM200 is shown, THE Terminal_Model SHALL display the digest signature status as `SIGNATURE VALID (ORIGINAL BATCH)` when `verifyDigest(Original_Digest, TRUSTED_SOURCE_KEYS[Original_Digest.sourceKeyId])` resolves true, using an own-property lookup, and as `SIGNATURE INVALID (ORIGINAL BATCH)` in every other case, including an unknown `sourceKeyId` (test: `digest_status`, example over the four samples, an unknown key id, `__proto__`, and a flipped signature byte)
6. THE digest status text SHALL name the original batch in every state, and WHILE the Working_Batch differs from the loaded batch, THE CTM200 screen SHALL show TAMPERED on the same row as the digest status, so that no reader can take a valid signature as a claim about the edited batch, and the status text SHALL stay the same as before the edit (test: `digest_status`, which edits a sample, then checks that the digest status row holds both TAMPERED and `(ORIGINAL BATCH)`, that the status text equals the pre-edit text, and that the screen text holds no claim that the Working_Batch matches the signed root)

### Requirement 5: Strict amount input

**User Story:** As a security reviewer, I want one strict parser for typed amounts, so that no float, wrapped or rounded value reaches the batch or the prover.

#### Acceptance Criteria

1. WHEN text of 1 to 13 digits with no leading zero (or exactly `0`) and a value below `AMOUNT_BOUND_CENTS` is given, THE Amount_Input SHALL return that value as a `bigint` built from the digit text without any `Number` step (test: `tamper_input_validation`, property over valid texts, which compares with `BigInt(text)` and with the formatted result)
2. IF the text is empty, holds a sign, a decimal point, an exponent, whitespace, a letter or a non-ASCII digit, has a leading zero before another digit, has 14 or more digits, or has 13 digits with a value of `AMOUNT_BOUND_CENTS` or more, THEN THE Amount_Input SHALL return a fixed uppercase field message and no value (test: `tamper_input_validation`, property over generated invalid texts plus the examples `abc`, `-5`, an empty text, `007`, `12345678901234` and `9007199254740993`)
3. THE Amount_Input SHALL return the value 0 for the text `0`, a value for `1099511627775` (`2^40 - 1`), and an error for `1099511627776` (`2^40`) and for every value within 4 of `2^53` (test: `tamper_input_validation`, boundary examples)
4. WHEN the Amount_Input returns an error, THE Terminal_Model SHALL show the message on the Status_Line, SHALL leave the Working_Batch and the limit unchanged, and SHALL keep the cursor in the Field (test: `tamper_input_validation`, example per error class)
5. THE field message SHALL contain no part of the typed text (test: `tamper_input_validation`, which plants sentinel digits in the rejected text and asserts they are absent from every rendered row)

### Requirement 6: Tamper mode

**User Story:** As a judge, I want to change one amount, or move one cent between two postings, so that the verifier can later show that the change is caught.

#### Acceptance Criteria

1. WHEN PF12 is pressed on CTM200, THE Terminal_Model SHALL toggle Tamper_Mode, and WHILE Tamper_Mode is on, THE Terminal_Model SHALL make the amount cell of each posting on the current page an unprotected Field and the PF_Bar SHALL show the tamper label (test: `tamper_toggle`)
2. WHEN Enter is pressed in Tamper_Mode with a valid amount in one posting's Field, THE Terminal_Model SHALL replace only that posting's `amountCents` in the Working_Batch, keep every other field of every posting, and keep Tamper_Mode on, and the next edit SHALL apply on top of the earlier ones (test: `tamper_edits_accumulate`, property over edit sequences, which compares with a reference model, and the example "move 1 cent between two postings" that keeps the debit and credit totals equal)
3. WHILE the Working_Batch differs from the loaded batch, THE Terminal_Model SHALL show TAMPERED on the Status_Line of CTM200 and CTM300, and WHEN every edit is reverted by typing the original amounts, THE Terminal_Model SHALL stop showing TAMPERED (test: `tamper_status`, example)
4. THE Terminal_Model SHALL keep the Original_Digest unchanged through all edits, and SHALL provide no signing, key generation or digest creation path (test: `tamper_keeps_digest`, property that the digest is identical after any edit sequence, and the existing `no_private_key_in_src`)
5. IF an edit is rejected by the Amount_Input, THEN THE Terminal_Model SHALL apply no part of the edit, including edits typed in the other Fields of the same submit (test: `tamper_input_validation`)

### Requirement 7: CTM300 pre-check and prove

**User Story:** As a prover, I want a failing batch to be refused at once with a named reason, and a good batch to prove with visible progress, so that I never wait for a proof that cannot succeed.

#### Acceptance Criteria

1. THE CTM300 screen SHALL show a policy limit Field prefilled with the decimal text of `LIMIT_CENTS`, and WHEN the Field is submitted, THE Amount_Input SHALL apply to it (test: `limit_field_prefill_and_rules`)
2. WHEN PF5 is pressed with no run active, THE Terminal_Model SHALL call `checkBatch(Working_Batch, limit)` first, and IF the result is `ok: false`, THEN THE Terminal_Model SHALL write `REJECTED: ` followed by `UNBALANCED`, `OVER_LIMIT_UNFLAGGED` or `OUT_OF_RANGE` to the Status_Line and SHALL not call the Prove_Port (test: `precheck_rejects_without_worker`, property over generated batches and limits, which asserts that the fake Prove_Port has zero calls and the reason equals the `checkBatch` reason)
3. WHEN `checkBatch` returns `ok: true`, THE Terminal_Model SHALL call `proveBatch(Working_Batch, Original_Digest, limit, onProgress)` on the Prove_Port once, and SHALL show each stage name that `onProgress` reports on the Status_Line (test: `prove_progress_stages`, example with a fake that reports every name in `PROVE_STAGES`)
4. WHILE a run is active, THE Terminal_Model SHALL answer PF5 with the Status_Line text PROOF IN PROGRESS and SHALL start no second run (test: `single_proof_at_a_time`, property over PF5 press counts, which asserts exactly one fake `proveBatch` call)
5. IF the Prove_Port rejects with a `ProveError`, THEN THE Terminal_Model SHALL show `PROVE_ERROR_MESSAGES[reason]` on the Status_Line, end the run, and accept PF5 again, and IF it rejects with any other value, THEN THE Terminal_Model SHALL show a fixed text that holds no part of the thrown value (test: `prove_error_display`, example over all nine reasons plus a thrown sentinel string)
6. THE CTM300 screen SHALL treat an edited Working_Batch like any other, so that a 1-cent edit shows `REJECTED: UNBALANCED` and a balanced 1-cent move starts a run and yields a bundle (test: `tamper_cases_on_ctm300`, example with the fake Prove_Port, and the full-proof counterpart in Requirement 10)

### Requirement 8: Leaving a run and delivering the result

**User Story:** As a prover, I want to leave the proving screen at any time without a stale result appearing later, and to take the bundle away when a proof succeeds.

#### Acceptance Criteria

1. WHEN the screen changes away from CTM300 while a run is active, THE Terminal_Model SHALL call `cancelProve` once and SHALL discard the result of that run, so that a resolve or reject that arrives later changes no screen, field or Status_Line (test: `leave_mid_proof`, with a fake that settles after the cancel and a property over the settle order)
2. WHEN a run resolves a `ProofBundle` while CTM300 is the current screen, THE Terminal_Model SHALL show the text PROOF GENERATED, the circuit version and the `batchId`, and the word VERIFIED SHALL appear nowhere on CTM300 in any state (test: `prove_success_screen`, which also scans the rendered text of CTM300 before, during and after a run for the word VERIFIED)
3. WHEN a bundle is present and PF9 is pressed, THE Terminal_Model SHALL return an effect to copy `bundleToJson(bundle)` to the clipboard, and WHEN PF10 is pressed, THE Terminal_Model SHALL return an effect to download `bundleToJson(bundle)` as a JSON file named from the `batchId` (test: `bundle_actions`, which asserts the effects and that no other text is in them)
4. WHEN a bundle is present, THE Terminal_Model SHALL show on the Screen_Grid the prefix `/verify#b=` and the length of the Verify_Link in characters, THE React view SHALL show the full Verify_Link on the page as the Link_Anchor under the Screen_Grid, PF11 SHALL open it, and `decodeBundle` of the text after `#b=` SHALL deep-equal the bundle (test: `verify_link_roundtrip`, property over bundles from the stubbed prove service, which checks the grid prefix and length text, the Link_Anchor `href` and text, and the decoded bundle)
5. IF the clipboard write fails, THEN THE Terminal_Model SHALL show a fixed COPY FAILED text and keep the bundle available for download (test: `bundle_actions`, example with a rejecting clipboard)
6. THE Terminal_Model SHALL hold the bundle only in memory, and SHALL drop it when the Working_Batch changes or the sample is left (test: `bundle_dropped_on_change`)

### Requirement 9: Privacy, wording and look

**User Story:** As a security reviewer, I want the UI to keep batch data in memory and out of URLs, logs and storage, with the green-screen look kept readable, so that the privacy rules hold in the UI as they do in the core.

#### Acceptance Criteria

1. THE `src/ui` and `src/main.tsx` sources SHALL contain no `console.*` call, no `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `importScripts`, no `localStorage`, `sessionStorage`, `indexedDB`, `caches` or `document.cookie`, no `parseFloat` or `parseInt`, no `Number(` call on an amount, no `dangerouslySetInnerHTML`, and no `fetch` call outside the Sample_Loader (test: `ui_static_scan`, which ignores comments and fails on any listed name in code)
2. THE only URL that holds app data SHALL be the Verify_Link, whose hash holds the public bundle, and no navigation, `history` call or link SHALL carry a posting, account, amount or salt (test: `url_holds_only_bundle`, which scans the rendered text of all screens and the `href` values of the React view for planted sentinel values)
3. THE `src`, `index.html`, `public` (except `samples` and `_redirects`) and `README.md` text SHALL contain neither the word IBM nor the string 3270, and the app SHALL load no font, script, image or style from another origin (test: `ui_wording_scan`, example, which also scans `index.html` and the built `dist/index.html` for `http://` and `https://` resource URLs)
4. THE React view SHALL use a green phosphor palette on a dark ground, a monospace font, and the theme values (colors, font, grid metrics) in one theme module, with a contrast ratio of at least 4.5 to 1 for every text color on its ground (test: `theme_contrast`, example, which computes the ratio from the theme values)
5. WHERE the user's `prefers-reduced-motion` is `reduce`, THE React view SHALL turn off every animation, including the cursor blink and the screen flicker, and the CRT effects (scanlines, glow) SHALL not lower any contrast ratio of criterion 4 (test: `theme_contrast`, which checks that the stylesheet has a `prefers-reduced-motion: reduce` block that disables all `animation` and that effect layers use `pointer-events: none` and are checked in the contrast computation)

### Requirement 10: Browser checks and build

**User Story:** As huynh, I want a real-browser run of the prover path and a clean production build, so that the judge path works on the built app and the deferred zk-core checks are closed.

#### Acceptance Criteria

1. THE Prover_E2E SHALL run only against the `npm run build` output served by `vite preview` on `127.0.0.1` with `--strictPort`, with no COOP/COEP header, SHALL open no external URL, and SHALL fail on any request whose origin is not the preview server, `blob:` or `data:` (test: `e2e_local_only`, which records the origin of every request and asserts the list of non-local origins is empty)
2. THE Playwright setup SHALL use `@playwright/test` pinned at exactly 1.62.0 with the cached Chromium and SHALL download no browser, and IF the cached Chromium is missing, THEN the task SHALL stop and ask huynh (test: `playwright_pin`, example, which checks `package.json` for the exact version without `^` or `~`, and the absence of any `playwright install` command in `package.json`, `playwright.config.ts`, `e2e` and `scripts`)
3. WHEN the clean sample is selected and PF5 is pressed on CTM300, THE Prover_E2E SHALL wait for a real proof, read the Verify_Link text from the Link_Anchor on the page, and assert that it starts with `/verify#b=` and that `decodeBundle` accepts the text after `#b=` (test: `prover_clean_to_link`, in `e2e/prover.spec.ts`)
4. WHEN the unbalanced sample is selected and PF5 is pressed on CTM300, THE Prover_E2E SHALL see `REJECTED: UNBALANCED` on the Status_Line and SHALL see no Web Worker created during the whole run (test: `prover_unbalanced_no_worker`, in `e2e/prover.spec.ts`, which counts the page's `worker` events)
5. WHEN F5 is pressed on CTM300, THE Prover_E2E SHALL see that the page did not reload, which it checks with a marker set on `window` before the key press and a navigation counter (test: `prover_f5_no_reload`, in `e2e/prover.spec.ts`)
6. WHEN the clean sample is edited in Tamper_Mode by moving 1 cent between two postings and PF5 is pressed, THE Prover_E2E SHALL see a bundle and a Verify_Link, so that the verifier spec can reject it at `DIGEST_MATCH` (test: `prover_move_cent_makes_bundle`, in `e2e/prover.spec.ts`)
7. THE app that imports the Prove_Service SHALL build with `npm run build`, and `npm run check:dist-vk` SHALL then pass on `dist`, which closes the check that `zk-core` Requirement 7.7 deferred (test: `dist_vk_asset`, run as a task "Done when" check that quotes `npm run build` and `npm run check:dist-vk` and its line `check-dist-vk: PASS`)
8. THE `dist` folder SHALL hold no file from `e2e`, `tests`, `scripts` or the Demo_Key, and `no_private_key_in_src` SHALL keep passing with the UI files in place (test: `dist_clean`, example, which lists `dist` and scans it for the key file name and key bytes, and `no_private_key_in_src`)

## Decisions and notes for review

1. **Account mask (4.1, 4.2).** Accounts are `bigint` values shown in a 20-digit column in the batch file. The Mask_Function lives in the new file `src/ledger/mask.ts` (pure, with its own test `mask_account` under `tests/ledger`), because `structure.md` gives account masking to `src/ledger`. The mask is 16 mask characters plus the last 4 digits of the zero-padded decimal, so an account below 10,000 still hides its leading zeros. The wording of the mask character is a design choice. Accepted by reviewer.
2. **Digest status scope (4.5, 4.6).** CTM200 verifies the signature of the Original_Digest only. Matching the Working_Batch root to the signed root needs the Poseidon hasher in WASM, which the verifier does by design, so CTM200 makes no claim about it. A tampered batch therefore still shows a valid signature, so the status text always reads `SIGNATURE VALID (ORIGINAL BATCH)` (or the INVALID form) and the CTM200 screen shows TAMPERED on the same row while the Working_Batch is edited. Accepted by reviewer, with the original-batch wording added.
3. **Leading zeros in typed amounts (5.2, 5.3).** The parser rejects `007` per `tech.md` ("reject leading-zero ambiguity"), while the text `0` is valid and is an explicit boundary example in `tamper_input_validation`. The batch file's zero-padded columns are not typed input. Accepted by reviewer.
4. **PF key assignment (2.1 to 2.3, 8.3, 8.4).** PF9 copy, PF10 download and PF11 open link are accepted by reviewer. PF5 prove, PF3 back, PF7 and PF8 paging and PF12 tamper are fixed by the product brief. Resolved: F11 and F12 are not handled at all, so the browser keeps full screen and developer tools. PF11 and PF12 are reached through Alt+Minus, Alt+Equal and the PF_Bar buttons. Accepted by reviewer.
5. **Success wording (8.2).** CTM300 shows PROOF GENERATED and never the word VERIFIED, so that VERIFIED stays reserved for the verifier result in the next spec. Accepted by reviewer.
6. **Moved work.** The Playwright harness work that `zk-core` task 4.2 deferred is replaced by the production-app specs in Requirement 10. The zk-core `worker_browser_e2e` harness page is not needed, because `prover_clean_to_link` proves in a real Web Worker through the real app. Leaving out the harness page is accepted by reviewer. The spike removal stays in Task 7.
7. **Edits outside `src/ui`.** This spec adds the new file `src/ledger/mask.ts` and its test `tests/ledger/mask.prop.test.ts`. It edits `package.json` and `package-lock.json` (pinned dev dependency and scripts), `tsconfig.json` (include `e2e` and `playwright.config.ts`), `index.html`, `src/main.tsx` and `src/ui/app.tsx`, and adds `playwright.config.ts`. `vite.config.ts` changes only if the design needs it. No other existing file in `src/zk` or `src/ledger` changes.
8. **Reviewer-accepted design points.** Accepted by reviewer: the Verify_Link placement (prefix and length on the grid, full link in the Link_Anchor under the grid, 8.4 and 10.3), the success wording (8.2), the `handleKey` signature without a screen id (the Key_Handler takes the key event only), the listed design risks, and leaving out the harness page.

# Requirements Document

## Introduction

`release` makes CryptTerm ready to publish. It removes the spike code, locks the page down with a Content Security Policy, adds three small UI polish items and a narrow-screen check, replaces the scaffold README, and ends with a draft deploy of the built app and a run of the full Playwright suite against the draft URL.

The spike removal is moved here from task 4.3 of the zk-core spec, and the file list of that task stands. The spike write-up `docs/spike-results.md` and the spec folder `.kiro/specs/zk-spike/` are kept.

Constraints that apply to every requirement:

- If any file under `src/zk` or `src/ledger` must change, other than the deletion of the `src/zk/spike*.ts` files of Requirement 1, work stops and huynh is asked. The Release_Gate checks this against the Base_Commit (Requirement 7.8). Only `src/ui`, `vite.config.ts`, `package.json`, `public/`, `e2e/`, `tests/`, `scripts/`, `README.md` and `docs/` may change in this spec.
- The page never loads or contacts a third-party origin. `connect-src 'self'` makes this a browser-enforced rule, because bb.js keeps `skipSrsInit` and its CDN URLs are never used.
- No COOP or COEP headers are added, because the prover runs with one thread.
- If bb.js or the worker needs more than the CSP of Requirement 2 allows, work stops and huynh is asked.
- Terminal copy is uppercase, terse and operational, and says "block-mode terminal". Third-party trademark names appear nowhere in the app, docs or README.
- No local file-system path, machine user name or email address appears in any document or in the README.
- No credit or attribution line is added anywhere.
- Nothing is pushed to a remote.
- Deploys are drafts only. The production flag of the Netlify CLI is never used. `netlify-cli` is not added to `package.json` or `package-lock.json`.
- A task is marked completed only after its "Done when" check has run in the session and the report quotes the command and its output.

## Glossary

- **Release_Repo**: The CryptTerm repository, as tracked by `git ls-files`.
- **Spike_Files**: The files named in Requirement 1: `spike.html`, `src/zk/spike*.ts`, `tests/zk/spike-*.test.ts`, `tests/zk/proof/proof-smoke.test.ts`, `scripts/check-spike-dist`, the `build:spike` and `check:spike-dist` entries of `package.json`, and the spike mode of `vite.config.ts`.
- **Kept_Spike_Files**: `docs/spike-results.md` and every file under `.kiro/specs/zk-spike/`.
- **Headers_File**: `public/_headers`, the single source of the response headers of the deployed app and of the preview server.
- **CSP**: The `Content-Security-Policy` header of the Headers_File for the path `/*`.
- **Preview_Server**: The `vite preview` server that the local e2e run uses, configured through `preview.headers` in `vite.config.ts`.
- **Built_Output**: The `dist/` folder produced by `npm run build`.
- **Terminal_Model**: The pure state machine in `src/ui/model`.
- **Prove_Screen**: The CTM300 screen.
- **Verify_Screen**: The CTM900 screen, on the route `/verify`.
- **Verify_Anchor**: The one anchor under the Screen_Grid of the Prove_Screen, drawn by `src/ui/terminal-view.tsx`. Before this spec its text is the full Verify_Link. After this spec its text is `OPEN VERIFIER` and its `href` is the full Verify_Link, which then appears nowhere else in the view.
- **Verify_Link**: The text `/verify#b=` followed by the whole base64url bundle (`prove.link` in the Terminal_Model).
- **Link_Row**: Body row 15 of the Prove_Screen (`linkRow` in `src/ui/model/screens/ctm300.ts`). It holds `LINK `, the prefix `/verify#b=`, the first 40 characters of the encoded bundle, and the length. It is not changed by this spec and it is not the full Verify_Link.
- **Verdict_Row**: The one body row that carries the outcome text, as the code draws it today. Its text is one of:
  - Verify_Screen, body row 17 (`verdictText` in `src/ui/model/screens/ctm900.ts`): `VERIFIED`; `REJECTED AT <STEP>` where `<STEP>` is each name of `VERIFY_STEP_ORDER` in `src/ui/model/verify-flow.ts` (`FORMAT`, `SIGNATURE`, `DIGEST_MATCH`, `POLICY`, `CIRCUIT`, `PROOF`); `REJECTED: VERIFIER ERROR` (`MESSAGES.VERIFIER_ERROR` in `src/ui/model/messages.ts`). The text `VERIFYING` (a run in progress) is not a verdict.
  - Prove_Screen, when the prove state is `done`, body row 8 (`ctm300.ts`): `PROOF GENERATED`.
  - Prove_Screen, when the prove state is `failed`, body row 9 (`ctm300.ts`, which holds `prove.message`): `REJECTED: <CheckReason>` from `checkBatch` in `src/ledger/check-batch.ts` (`REJECTED: OUT_OF_RANGE`, `REJECTED: UNBALANCED`, `REJECTED: OVER_LIMIT_UNFLAGGED`); any text of `PROVE_ERROR_MESSAGES` in `src/zk/prove-service.ts` (for example `PROOF GENERATION FAILED: DEBITS NOT EQUAL TO CREDITS`); or `MESSAGES.UNEXPECTED` (`PROOF GENERATION FAILED: UNEXPECTED ERROR`). Row 8 then reads `PROOF NOT GENERATED` and is not the Verdict_Row. The status line (row 24) repeats the same message, is not the Verdict_Row and keeps its own style.
- **Base_Commit**: Commit `3655ff7`, the state of the Release_Repo before this spec.
- **Inverse_Video**: The drawing style of the title row, with the theme inverse color on the theme text color.
- **Screen_Grid**: The 80-column by 24-row character grid.
- **PF_Bar**: The row of PF key labels, with one on-screen button per label.
- **Narrow_Viewport**: A browser viewport of 375 by 812 pixels.
- **README**: `README.md` at the repository root.
- **E2E_Suite**: The Playwright specs under `e2e/`.
- **Base_URL**: The `BASE_URL` environment variable that the Playwright configuration reads.
- **Route_Guard**: The request guard in `e2e/` that aborts and records every request whose origin is not allowed.
- **Draft_Deploy**: A run of `netlify deploy --dir dist --no-build` through the Netlify power, as the zk-spike did it, without `--prod` and without `--build`. `netlify-cli` is not a dependency of the Release_Repo.
- **Draft_URL**: The unique URL that the Draft_Deploy prints.
- **Release_Gate**: The final list of checks in Requirement 7.

## Requirements

### Requirement 1: Spike removal

**User Story:** As a maintainer, I want the spike code gone from the repository, so that the published source holds only the product and the spike record.

#### Acceptance Criteria

1. THE Release_Repo SHALL contain no Spike_Files after the removal, and every file that is listed by `git ls-files` with `spike` in its path SHALL be a Kept_Spike_File (check: `spike_files_removed`, the command `git ls-files | grep -i spike`, whose output lists only the Kept_Spike_Files)
2. THE directories `src`, `scripts` and `e2e`, and the files `vite.config.ts` and `package.json`, SHALL contain no occurrence of the word `spike` (check: `spike_word_absent`, the command `grep -rn "spike" src scripts e2e vite.config.ts package.json`, whose output is empty)
3. THE two references to a removed Spike_File in `tests/zk/proof-isolation.test.ts` SHALL point to files that exist, and the test SHALL keep its original assertions (test: `proof_isolation`, the existing Vitest file, run by `npm test`)
4. WHEN `npm run build` runs after the removal, THE Built_Output SHALL contain no file whose name has `spike` in it (check: `dist_no_spike_files`, the command `find dist -iname "*spike*"`, whose output is empty)

### Requirement 2: Security headers

**User Story:** As a verifier of the page itself, I want the browser to enforce that the app talks only to its own origin, so that no batch data can leave the page even if a bug tried to send it.

#### Acceptance Criteria

1. THE Headers_File SHALL set, for the path `/*`, a CSP with the directives `default-src 'self'`, `connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'` and `form-action 'none'`, and the headers `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` (test: `headers_file_policy`, a Vitest example that parses the Headers_File and compares each directive and header)
2. THE CSP SHALL carry a `style-src` directive that grants every style source the Built_Output needs, found by inspecting the Built_Output and not by guessing (check: `csp_matches_build`, a Vitest check run with `CHECK_DIST=1` that scans `dist/index.html`, the built CSS and the built scripts for inline styles, `data:` or `blob:` images and external origins, and fails ONLY when the Built_Output needs a source that the CSP does not grant; a granted source that nothing uses does not fail the check)
3. THE CSP SHALL set `img-src 'none'`, unless the browser's request for `/favicon.ico` (`index.html` has no icon link) raises a CSP violation or a console error, in which case THE CSP SHALL set `img-src 'self'` and the reason SHALL be recorded in `design.md` without asking huynh (check: `img_src_decision`, a Playwright observation of the `/favicon.ico` request on the built page with a `securitypolicyviolation` listener and a console listener, and the matching `img-src` value in the Headers_File)
4. THE Headers_File SHALL contain no `Cross-Origin-Opener-Policy` header and no `Cross-Origin-Embedder-Policy` header (test: `headers_file_policy`)
5. THE Preview_Server SHALL send the headers that it reads from the Headers_File and SHALL hold no second copy of them in `vite.config.ts` (test: `preview_headers_from_file`, a Vitest example that loads the Vite config and compares `preview.headers` with the parsed Headers_File)
6. WHEN the E2E_Suite proves a batch and verifies the bundle, THE page SHALL raise no `securitypolicyviolation` event and no console error that names the CSP (test: `csp_no_violation`, a Playwright spec that registers a `securitypolicyviolation` listener before navigation and a console listener, runs the prove and verify path, and asserts both lists are empty)
7. IF a request goes to an origin other than the page origin during the prove and verify path, THEN THE Route_Guard SHALL abort the request and the E2E_Suite SHALL fail with the origin in the failure message (test: `route_guard_records_foreign_origin`, the existing guard test extended)

### Requirement 3: Prove and verify screen polish

**User Story:** As a judge watching the video, I want a short verifier link and a verdict that stands out, so that the demo is easy to follow.

#### Acceptance Criteria

1. WHEN a proof exists on the Prove_Screen, THE Link_Row SHALL stay as it is, and no Screen_Grid row SHALL hold the full Verify_Link, and THE view SHALL show the Verify_Anchor under the Screen_Grid with the text `OPEN VERIFIER` and the full Verify_Link as its `href`; this changes `src/ui/terminal-view.tsx`, which today prints the full Verify_Link as the anchor text (test: `ctm300_verify_anchor`, a model example that scans every row for the full `prove.link` and finds none while the Link_Row is still present, plus the Playwright spec `e2e/prover.spec.ts`, updated to read the `href` of the anchor and to assert the anchor text `OPEN VERIFIER`)
2. THE Verify_Anchor SHALL be the only element with an `href` in the view, and the full Verify_Link SHALL appear in the view only as that `href` (test: `ctm300_verify_anchor`, a Playwright assertion over `a[href]` and over the page text)
3. THE Verdict_Row of the Prove_Screen and of the Verify_Screen SHALL be drawn in Inverse_Video with the same style rule as the title row (test: `verdict_row_inverse`, a model example that reads the real texts from `verdictText` and `VERIFY_STEP_ORDER`, `MESSAGES`, `checkBatch` reasons and `PROVE_ERROR_MESSAGES` and does not retype them: `VERIFIED`, `REJECTED AT <STEP>` for each name of `VERIFY_STEP_ORDER`, `REJECTED: VERIFIER ERROR`, `PROOF GENERATED`, `REJECTED: <CheckReason>` for each of `OUT_OF_RANGE`, `UNBALANCED` and `OVER_LIMIT_UNFLAGGED`, every text of `PROVE_ERROR_MESSAGES`, and `PROOF GENERATION FAILED: UNEXPECTED ERROR`, plus a Playwright assertion that the computed colors of the Verdict_Row equal those of the title row)
4. WHILE the Screen_Grid holds no Verdict_Row text, THE Screen_Grid SHALL draw every body row in the normal style, and this covers the prove states idle (row 8 `PF5: GENERATE PROOF`), proving (rows 8 and 9), and failed (row 8 `PROOF NOT GENERATED`), the Verify_Screen text `VERIFYING`, the Verify_Screen with no outcome, and the status line (test: `verdict_row_inverse`, a model example over each of these states)

### Requirement 4: Narrow-screen layout

**User Story:** As a judge who opens the link on a phone, I want the page to stay readable without sideways scrolling, so that I can follow the demo on a small screen.

#### Acceptance Criteria

1. WHILE the viewport is a Narrow_Viewport, THE page SHALL satisfy `document.documentElement.scrollWidth <= 375` on CTM000, on the Prove_Screen after a proof, and on the Verify_Screen (test: `narrow_screen`, a Playwright spec with one assertion per screen)
2. WHILE the viewport is a Narrow_Viewport, THE Screen_Grid SHALL use a computed font size of at least 11 px, and the Screen_Grid SHALL scroll inside its own frame when the grid is wider than the viewport (test: `narrow_screen`, which reads the computed font size and the `scrollWidth` and `clientWidth` of the frame)
3. WHILE the viewport is a Narrow_Viewport, THE page SHALL show every PF_Bar button inside the viewport width, each with a width and a height of at least 24 CSS pixels (test: `narrow_screen`, which reads the bounding box of every PF_Bar button)

### Requirement 5: README

**User Story:** As a judge or a developer, I want a README that explains what CryptTerm is, how far to trust it and how to run it, so that I can reproduce the demo.

#### Acceptance Criteria

1. THE README SHALL replace the scaffold text and SHALL hold these sections, in this order: what CryptTerm is in plain words, the trust model, the two tamper cases, run locally, regenerate samples and circuit identity, stack and versions, how Kiro was used, and license (check: `readme_sections`, a Vitest example that reads the README and compares the second-level headings with the list)
2. THE trust-model section SHALL keep the existing trust-model bullet points, and SHALL state that the demo signing key is `DEMO ONLY` and public by design (check: `readme_sections`, which looks for the bullet texts of the product steering file and for the words `DEMO ONLY` and `public by design`)
3. THE run-locally section SHALL list `npm ci`, `npm run dev`, `npm test`, `npm run test:circuit` with `nargo 1.0.0`, `npm run test:proof` and `npm run test:e2e`, and the regenerate section SHALL list `npm run gen:samples` and `npm run gen:identity` (check: `readme_commands`, a Vitest example that checks each listed script name exists in `package.json`)
4. THE stack section SHALL list each runtime and tool dependency of `package.json` with the exact version that `package.json` holds (check: `readme_versions`, a Vitest example that compares the README versions with `package.json`)
5. THE Kiro section SHALL name the specs, the steering files, the save hook, the circuit-auditor agent, the property tests and `tests/PBT-LOG.md`, in no more than 15 lines (check: `readme_kiro_section`, a Vitest example over the section line count and the names)
6. THE README SHALL contain no third-party trademark name, no local file-system path, no machine user name and no email address (check: the third-party-name and path searches of the Release_Gate)

### Requirement 6: Draft deploy and remote e2e

**User Story:** As huynh, I want the built app deployed as a draft and the full e2e suite run against it, so that I know the published site behaves like the local one under the real host headers.

#### Acceptance Criteria

1. WHEN the Playwright configuration starts with Base_URL set, THE E2E_Suite SHALL run against Base_URL, SHALL start no local preview server, and THE Route_Guard SHALL allow exactly the origin of Base_URL and keep recording every other origin (test: `guard_base_url`, a Vitest example over the guard function with a set and an unset Base_URL)
2. WHEN Base_URL is not set, THE E2E_Suite SHALL run against the Preview_Server as before (test: `guard_base_url`, the same example)
3. WHEN a Draft_Deploy is requested, THE release task SHALL load the Netlify power overview, SHALL run `netlify status`, SHALL report to huynh which site and account the deploy targets, SHALL wait for his confirmation (as requirement 12.1 of the zk-spike did), and only then SHALL run `netlify deploy --dir dist --no-build` with neither `--prod` nor `--build` (check: `draft_deploy_command`, the task report quoting the status output, huynh's confirmation and the deploy command line)
4. IF the Netlify CLI is not logged in or the project is not linked, THEN THE release task SHALL stop and ask huynh before any deploy (check: `draft_deploy_command`, the task report)
5. IF a deploy would publish anything other than the contents of `dist/`, THEN THE release task SHALL stop and ask huynh (check: `dist_contents_only`, the command `netlify deploy --dir dist` target listing compared with `ls dist`)
6. WHEN the Draft_Deploy finishes, THE release task SHALL run the full E2E_Suite with Base_URL set to the Draft_URL, and SHALL report the Draft_URL and the Playwright summary line (check: `remote_e2e`, the command `BASE_URL=<Draft_URL> npm run test:e2e` and its output)
7. THE files `package.json` and `package-lock.json` SHALL stay unchanged during group 3 of `tasks.md`, the group that holds the Draft_Deploy and the remote E2E_Suite run (check: `lockfile_unchanged`, the command `git status --short package.json package-lock.json`, whose output is empty)

### Requirement 7: Release gate

**User Story:** As huynh, I want one final list of checks that must all pass, so that I can trust the state of the repository before I publish.

#### Acceptance Criteria

1. WHEN the release work is finished, THE Release_Gate SHALL run `npm run typecheck`, `npm test`, `npm run test:circuit`, `npm run test:proof` and `npm run build`, and each command SHALL exit with status 0 (check: `gate_commands`, the quoted summary line of each command)
2. WHEN `npm run build` has finished, THE Release_Gate SHALL run the Vitest suite with `CHECK_DIST=1` and run `npm run check:dist-vk`, and both SHALL pass (check: `gate_dist_checks`, the quoted output)
3. WHEN the checks of criteria 1 and 2 have passed, THE Release_Gate SHALL run the local E2E_Suite under the CSP of the Preview_Server, and the run SHALL pass (check: `gate_local_e2e`, the Playwright summary line)
4. WHEN the Draft_Deploy has finished, THE Release_Gate SHALL include the remote E2E_Suite run of Requirement 6 (check: `remote_e2e`)
5. THE command `git check-ignore -v .kiro` SHALL print nothing (check: `kiro_tracked`, the command output)
6. THE case-insensitive search of `src`, `e2e`, `public` and `README.md` for the two forbidden third-party names SHALL print nothing, with the pattern written as `i[b]m\|32[7]0` so that the checked-in text does not contain the names (check: `gate_trademarks`, the command `grep -rni "i[b]m\|32[7]0" src e2e public README.md`)
7. THE search of `README.md`, `docs`, `src` and `e2e` for the text `/User[s]/` SHALL print nothing (check: `gate_local_paths`, the command `grep -rn "/User[s]/" README.md docs src e2e`)
8. IF any file under `src/zk` or `src/ledger` differs from the Base_Commit by anything other than the deletion of the `src/zk/spike*.ts` files of Requirement 1, THEN THE Release_Gate SHALL fail (check: `gate_core_untouched`, the command `git diff --stat 3655ff7 HEAD -- src/zk src/ledger`, which passes when it lists only the deleted `src/zk/spike*.ts` files and nothing else)

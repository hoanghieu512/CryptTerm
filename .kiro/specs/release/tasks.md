# Implementation Plan: release

## Overview

Nine tasks in three groups, plus a commit at the start. Group 1 removes the spike code and adds the CSP with its e2e check. Group 2 does the UI polish, the narrow-screen layout and the README. Group 3 builds, deploys a draft, and runs the final checks. Each group ends with a commit that stages files by name. Nothing is pushed. No credit or attribution line is added anywhere.

## Rules for every task

- **Evidence before status** (structure.md): a task is marked completed only after its "Done when" check has been run in this session. The report quotes the actual command and its output: `git log -1 --oneline` for commits, `ls` for created files, the test summary line for tests. Never report a hash, file, size or output that this session did not produce.
- **Stop and ask huynh** if any file under `src/zk` or `src/ledger` must change (the only exception is the deletion of the spike files that Requirement 1 names), if bb.js or the worker needs more than the CSP of Requirement 2 allows, or if the Netlify CLI is not logged in or the project is not linked.
- **Drafts only**: the deploy command is `netlify deploy --dir dist --no-build` and never carries `--prod` or `--build`. Run `netlify status` first, report the site and account, and wait for huynh's confirmation. `netlify-cli` is run through `npx` only and is never added to `package.json`.
- Stage files by name. Never use `git add -A` or `git add .`. Never push.
- No local file-system path, machine user name or email address in any file this spec writes. Terminal copy stays uppercase, terse and operational.

## Tasks

- [x] 0. Commit the spec files
  - Run `git add .kiro/specs/release/requirements.md .kiro/specs/release/design.md .kiro/specs/release/tasks.md .kiro/specs/release/tasks.meta.json .kiro/specs/release/.config.kiro`.
  - Commit with the message `Add release spec`.
  - **Done when:** `git log -1 --oneline` prints the `Add release spec` commit and `git status --short .kiro/specs/release` prints nothing.

- [x] 1. Group 1: spike removal and security headers
  - [x] 1.1 Remove the spike files and their references
    - Delete `spike.html`, `src/zk/spike*.ts`, `tests/zk/spike-*.test.ts`, `tests/zk/proof/proof-smoke.test.ts` and `scripts/check-spike-dist`.
    - Remove the `build:spike` and `check:spike-dist` entries from `package.json` and the spike mode from `vite.config.ts`.
    - Point the two references to removed files in `tests/zk/proof-isolation.test.ts` at files that exist and keep its assertions.
    - Fix any other test under `tests/` that names a removed file (for example the static-scan and hook-config tests) without weakening what it asserts.
    - Keep `docs/spike-results.md` and everything under `.kiro/specs/zk-spike/`.
    - If any other file under `src/zk` or `src/ledger` must change, stop and ask huynh.
    - Add the Vitest examples `spike_files_removed`, `spike_word_absent` and `dist_no_spike_files` (the last runs only with `CHECK_DIST=1`).
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
    - **Done when:** `git ls-files | grep -i spike` lists only `docs/spike-results.md` and the `.kiro/specs/zk-spike/` files, `grep -rn "spike" src scripts e2e vite.config.ts package.json` prints nothing, and `npm test` ends with a passing summary line.

  - [x] 1.2 Add the headers file, its parser and the preview headers
    - Write `public/_headers` for `/*` with the CSP of the design (`default-src 'self'`, `connect-src 'self' data:`, `script-src 'self' 'wasm-unsafe-eval'`, `worker-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, plus `style-src` and `img-src`), `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. No COOP or COEP header.
    - Inspect `dist/` after a build and set `style-src` to what the build needs. Start with `img-src 'none'`. Task 1.3 decides whether it stays.
    - Write `scripts/parse-headers.ts` exporting `headersFor(path, text)`. Make `vite.config.ts` build `preview.headers` from `public/_headers` and throw at load time if the file is missing or has no `/*` block. Keep no second copy of the header text.
    - Write the Vitest examples `headers_file_policy`, `preview_headers_from_file` and `csp_matches_build` (the last runs only with `CHECK_DIST=1`). `csp_matches_build` fails only when the build needs a source that the CSP does not grant. A granted source that nothing uses does not fail it.
    - If bb.js or the worker needs more than this CSP, stop and ask huynh.
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
    - **Done when:** `ls public/_headers scripts/parse-headers.ts` lists both files and `npm run build && CHECK_DIST=1 npx vitest run tests/ui` ends with a passing summary line that includes the three new tests.

  - [x] 1.3 Add the BASE_URL resolver, the CSP e2e check and the group 1 commit
    - Write `e2e/base-url.ts` with `resolveBaseUrl(env)` and `isLocalOrigin(url, origin)`. Treat an unparseable URL as not local.
    - Make `playwright.config.ts` use `resolveBaseUrl()` and define `webServer` only when `BASE_URL` is unset. Make `e2e/helpers.ts` take `ORIGIN` from `resolveBaseUrl()` and wrap `isLocalOrigin` in its guard.
    - Add the Vitest example `guard_base_url` and the property test for the route guard, **Property 2: The route guard is exact about the configured origin**, over generated base origins and URLs (same origin, foreign origin, `blob:`, `data:`, unparseable).
    - Add the Playwright spec `csp_no_violation`: register a `securitypolicyviolation` listener and a console listener before navigation, run the prove and verify path, assert both lists are empty. Extend the guard test `route_guard_records_foreign_origin` so a foreign-origin failure names the origin. The `/favicon.ico` request is same-origin, so the guard must not flag it.
    - Favicon step (`img_src_decision`): run `csp_no_violation`. If the browser's `/favicon.ico` request raises a `securitypolicyviolation` event or a console error, change `img-src` to `'self'` in `public/_headers`, rerun, and record the reason in `design.md` under the Favicon note. Do not ask huynh. Otherwise record in `design.md` that `img-src 'none'` held.
    - Commit by name: `public/_headers`, `scripts/parse-headers.ts`, `vite.config.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`, `e2e/base-url.ts`, `e2e/helpers.ts`, the new and changed spec and test files, the removals from task 1.1 (`git rm` stages them), `.kiro/specs/release/design.md`, `.kiro/specs/release/tasks.md` and `.kiro/specs/release/tasks.meta.json`.
    - _Requirements: 2.3, 2.5, 2.6, 2.7, 6.1, 6.2_
    - **Done when:** `npm run test:e2e` ends with a passing Playwright summary line that includes `csp_no_violation`, the Favicon note in `design.md` records the outcome, and `git log -1 --oneline` prints the group 1 commit.

- [ ] 2. Group 2: UI polish, narrow screen and README
  - [ ] 2.1 Change the verify anchor text and add the inverse verdict row
    - Change `src/ui/terminal-view.tsx` so the text of the `<a data-testid="verify-link">` anchor is `OPEN VERIFIER` and the full Verify_Link is only its `href`. The existing LINK preview row (`linkRow` in `ctm300.ts`) stays unchanged.
    - Add `verdictRowOf(state): number | null` to `ctm300.ts` and `ctm900.ts`. It returns 8 (CTM300 `done`), 9 (CTM300 `failed`), 17 (CTM900 with a verdict text) or `null`. `terminal-view.tsx` applies the existing title-row class to that body row. No new colour rule.
    - Write the property test **Property 1: The full Verify_Link never appears on a body row** over generated bundles, reusing the arbitraries in `tests/support/`. It asserts that no body row contains the full link, the anchor text is exactly `OPEN VERIFIER`, and the `href` equals the link.
    - Write the Vitest example `ctm300_verify_anchor`: scan every grid row for the full `prove.link` and find none, while the LINK preview row is still present.
    - Write the Vitest example `verdict_row_inverse`. It reads the texts from the model modules and does not retype them:
      - Row 17: `verdictText` (`VERIFIED`, `REJECTED AT <STEP>` for each name of `VERIFY_STEP_ORDER`) and `MESSAGES.VERIFIER_ERROR` (`REJECTED: VERIFIER ERROR`).
      - Row 8: `MESSAGES.DONE` (`PROOF GENERATED`) when CTM300 is `done`.
      - Row 9: `prove.message` when CTM300 is `failed`, for each `CheckReason` of `checkBatch` (`REJECTED: UNBALANCED` and the others), each text of `PROVE_ERROR_MESSAGES` and `MESSAGES.UNEXPECTED`.
      - `null`: CTM300 idle, CTM300 proving, CTM300 failed row 8 (`PROOF NOT GENERATED`), the status row, CTM900 `VERIFYING` and CTM900 with no outcome.
    - Update `e2e/prover.spec.ts` to read the `href` of the anchor instead of its text, assert the anchor text is `OPEN VERIFIER`, and assert `a[href]` matches only that anchor. Assert the computed colors of the Verdict_Row equal those of the title row on CTM900 and on CTM300. The CTM300 failed case uses the unbalanced sample and sees `REJECTED: UNBALANCED` on body row 9.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
    - **Done when:** `npx vitest run tests/ui` and `npx playwright test e2e/prover.spec.ts e2e/verifier.spec.ts` both end with passing summary lines.

  - [ ] 2.2 Add the narrow-screen layout and its spec
    - In `src/ui/terminal.css`, add a media query for narrow viewports: font size floor of 11 px, `.ct-frame` as its own horizontal scroll container with `max-width: 100vw`, and PF buttons at least 24 by 24 CSS pixels that stay inside the viewport.
    - Write `e2e/narrow-screen.spec.ts` (`narrow_screen`) at 375 by 812: `document.documentElement.scrollWidth <= 375` on CTM000, on the Prove_Screen after a proof and on the Verify_Screen, grid font size of at least 11 px, frame scroll when the grid is wider than the viewport, every PF_Bar button inside the viewport and at least 24 by 24.
    - _Requirements: 4.1, 4.2, 4.3_
    - **Done when:** `npx playwright test e2e/narrow-screen.spec.ts` ends with a passing summary line.

  - [ ] 2.3 Rewrite the README and make the group 2 commit
    - Replace the scaffold text with these second-level sections in order: what CryptTerm is, trust model, the two tamper cases, run locally, regenerate samples and circuit identity, stack and versions, how Kiro was used, license.
    - Trust model: keep the bullets of the product steering file and state that the demo signing key is `DEMO ONLY` and public by design.
    - Run locally: `npm ci`, `npm run dev`, `npm test`, `npm run test:circuit` with `nargo 1.0.0`, `npm run test:proof`, `npm run test:e2e`. Regenerate: `npm run gen:samples`, `npm run gen:identity`.
    - Stack: each dependency of `package.json` with its exact version. Kiro section: 15 lines or fewer, naming the specs, the steering files, the save hook, the circuit-auditor agent, the property tests and `tests/PBT-LOG.md`.
    - Write the Vitest examples `readme_sections`, `readme_commands`, `readme_versions` and `readme_kiro_section`.
    - Commit by name: `README.md`, `src/ui/terminal.css`, `src/ui/terminal-view.tsx`, `src/ui/model/screens/ctm300.ts`, `src/ui/model/screens/ctm900.ts`, the new and changed tests and e2e specs, `.kiro/specs/release/tasks.md` and `.kiro/specs/release/tasks.meta.json`. Stage only files that changed.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
    - **Done when:** `npm test` ends with a passing summary line that includes the four README tests, and `git log -1 --oneline` prints the group 2 commit.

- [ ] 3. Group 3: draft deploy and final checks
  - [ ] 3.1 Build and deploy a draft
    - Do not add `netlify-cli` to `package.json`. As the zk-spike did (see `docs/spike-results.md`), run the CLI as `npx --yes netlify-cli@27.20.1`, an npx run only.
    - Load the Netlify power overview (`power::netlify-deployment::overview`). Run `npm run build`. Run `netlify status` and report the site and account to huynh. Wait for his confirmation before deploying. If the CLI is not logged in or the project is not linked, stop and ask huynh.
    - Compare what the deploy would publish with `ls dist`. If it would publish anything other than the contents of `dist/`, stop and ask huynh.
    - Run `netlify deploy --dir dist --no-build` with neither `--prod` nor `--build`. Record the Draft_URL.
    - _Requirements: 6.3, 6.4, 6.5, 6.7_
    - **Done when:** the report quotes the `netlify status` output, huynh's confirmation, the exact deploy command line and the Draft_URL, and `git status --short package.json package-lock.json` prints nothing.

  - [ ] 3.2 Run the final checks and make the group 3 commit
    - Run each command and quote its summary line and exit status. Stop at the first non-zero exit.
      - `npm run typecheck`
      - `npm test`
      - `npm run test:circuit`
      - `npm run test:proof`
      - `npm run build`
      - `CHECK_DIST=1 npx vitest run`
      - `npm run check:dist-vk`
      - `npm run test:e2e` (local, under the CSP of the preview server)
      - `BASE_URL=<Draft_URL> npm run test:e2e` (remote, against the draft from task 3.1). Report the Draft_URL and the Playwright summary line. If a source file changed after the draft was deployed, rebuild and redeploy first.
    - Run the repository checks and quote the output of each:
      - `git check-ignore -v .kiro` prints nothing.
      - `grep -rni "i[b]m\|32[7]0" src e2e public README.md` prints nothing.
      - `grep -rn "/User[s]/" README.md docs src e2e` prints nothing.
      - `git diff --stat 3655ff7 HEAD -- src/zk src/ledger` lists only the deleted `src/zk/spike*.ts` files of Requirement 1 and nothing else.
      - `git status --short package.json package-lock.json` prints nothing.
    - Commit by name: `.kiro/specs/release/tasks.md` and `.kiro/specs/release/tasks.meta.json`. Do not stage `package.json` or `package-lock.json`. Do not push.
    - _Requirements: 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
    - **Done when:** every command above has been run in this session with its output quoted, the remote summary line names the Draft_URL, and `git log -1 --oneline` prints the group 3 commit.

## Notes

- Property tests (Property 1 and Property 2 of the design) are part of tasks 1.3 and 2.1 and are not optional. No task here is marked optional.
- The e2e Playwright specs need the built app. Run `npm run build` before them when `dist/` is stale.
- The Draft_URL is public to anyone who has the link. It serves only the contents of `dist/`: signed samples and the demo public key.

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
    { "id": 8, "tasks": ["3.2"] }
  ]
}
```

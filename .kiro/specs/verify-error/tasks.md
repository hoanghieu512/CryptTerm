# Implementation Plan: verify-error

## Overview

One commit task and four implementation sub-tasks, in this order: tests first (1.1), the `src/zk` change (1.2), the CTM900 mapping (1.3), then rebuild, draft deploy, final checks and the final commit (1.4). The proof check changes from a boolean to `'valid' | 'invalid' | 'not_completed'`, so a timeout, worker error, post failure or `failed` event is reported as `REJECTED: VERIFIER ERROR` and never as `PROOF INVALID`. The verifier keeps failing closed. Nothing is pushed. No credit or attribution line is added anywhere.

## Rules for every task

- **Evidence before status** (structure.md): a task is marked completed only after its "Done when" command has been run in this session. The report quotes the actual command and its output: `git log -1 --oneline` for commits, the test summary line for tests, the file listing for created files. Never report a hash, file, size or output that this session did not produce.
- **Stop and ask huynh** if the fix needs a change to `src/zk/worker-core.ts`, `src/zk/worker-protocol.ts`, the prover side, `src/ledger`, the circuit or the bundle codec. The only files under `src/zk` that may change are `verify-client.ts` and `verifier.ts`.
- **Drafts only**: the deploy command is `npx --yes netlify-cli@27.20.1 deploy --dir dist --no-build` and never carries `--prod` or `--build`. `netlify-cli` runs through `npx` only and is never added to `package.json`.
- Stage files by name. Never use `git add -A` or `git add .`. Never push.
- No email address, account name or local file-system path in any file this spec writes. Terminal copy stays uppercase, terse and operational.
- No task here is optional.

## Tasks

- [-] 0. Commit the spec files
  - Run `git add .kiro/specs/verify-error/requirements.md .kiro/specs/verify-error/design.md .kiro/specs/verify-error/tasks.md .kiro/specs/verify-error/tasks.meta.json .kiro/specs/verify-error/.config.kiro`.
  - Commit with the message `Add verify-error spec`.
  - **Done when:** `git log -1 --oneline` prints the `Add verify-error spec` commit and `git status --short .kiro/specs/verify-error` prints nothing.

- [ ] 1. Fix the false PROOF INVALID verdict
  - [~] 1.1 Write the failing tests and the mechanical test-helper updates
    - Write `tests/zk/verify-client-outcomes.prop.test.ts` (`verify_client_outcomes`, **Property 1: Proof_Client outcomes are deterministic, exhaustive and sticky**). Drive `createProofVerifier` with a fake `WorkerPort` and randomized trigger sequences: a `verified` event with `valid` true or false, a `failed` event, a port error, a `post` throw and a timeout, over several concurrent runs and a randomized injected `timeoutMs`. Assert every run resolves to exactly one of the strings `'valid'`, `'invalid'`, `'not_completed'` by strict equality, that a later trigger for a settled run changes nothing, and that nothing else is carried.
    - In the same file add the examples: `VERIFY_TIMEOUT_MS` equals `120_000`, and under fake timers a run made with the default timeout is still pending at 119,999 ms and resolves `'not_completed'` at 120,000 ms.
    - Write `tests/zk/proof-step-not-completed.prop.test.ts` (`proof_step_not_completed`, **Property 2: PROOF step detail comes only from the fixed set, keyed by outcome**). Use five stand-ins: answers `'valid'`, answers `'invalid'`, throws, rejects, and resolves a value that is neither string. Throws and rejections carry a random sentinel string. Assert `proofStep` returns `'valid'`, `'invalid'`, `'not_completed'`, `'not_completed'`, `'not_completed'`, that the `PROOF` step has `ok` and `detail` of `PROOF VALID`, `PROOF INVALID` or `PROOF CHECK NOT COMPLETED` as keyed by the outcome, that the verdict is `REJECTED` whenever `ok` is false, and that the sentinel appears nowhere in the report. Add an example that `NOT_COMPLETED_DETAIL` equals the literal `PROOF CHECK NOT COMPLETED` and is the `notCompleted` text of `VERIFY_DETAILS.PROOF`.
    - Write `tests/ui/ctm900-verifier-error-row.prop.test.ts` (`ctm900_verifier_error_row`, **Property 3: The Verify_Model shows VERIFIER ERROR only for a check that did not finish**). Build well-formed reports by hand that fail at each of the six steps, and at `PROOF` with each of the two fixed fail texts. Write the not-completed text as the literal `PROOF CHECK NOT COMPLETED` so the test does not depend on the new export. Assert, through `normalizeReport`, `settleRun` and `verdictText`, that a `PROOF` failure with that text stores outcome kind `error` and shows `MESSAGES.VERIFIER_ERROR`, a `PROOF` failure with `PROOF INVALID` shows `REJECTED AT PROOF`, an earlier failure shows `REJECTED AT <STEP>`, and `VERIFIED` appears only for six passed steps. Keep the existing `verdict_row_inverse` and `normalizeReport` tests unchanged.
    - Update the helpers and tests that assert the old boolean contract. Each change is mechanical:
      - `tests/support/signed-bundle.ts`: `recordingVerifier(result: 'valid' | 'invalid' = 'valid')` returns the string.
      - `tests/zk/verifier-order.prop.test.ts`: `recordingVerifier(!faults.has('PROOF'))` becomes `recordingVerifier(faults.has('PROOF') ? 'invalid' : 'valid')`.
      - `tests/ui/verify-bad-inputs.prop.test.ts`: `recordingVerifier(true)` becomes `recordingVerifier('valid')`.
      - `tests/zk/verifier-compare.prop.test.ts`: `recordingVerifier(true)` becomes `recordingVerifier('valid')` and `expect(passed).toBe(true)` becomes `expect(passed).toBe('valid')`. The design does not list this file. It calls `proofStep` directly, so it needs the same update.
      - `tests/zk/verify-never-throws.prop.test.ts`: kinds `true` and `false` return `'valid'` and `'invalid'`. Kinds `throw`, `reject` and `nonBoolean` stay as they are and are now folded to `not_completed` by the verifier. `expectedLast` still ends at `PROOF`. `ALL_DETAILS` includes `d.notCompleted` where present.
    - Do not touch any file under `src/` in this task. Run the tests against the unchanged source so they fail for the expected reason.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.10, 3.1, 3.2, 3.3_
    - **Done when:** `ls tests/zk/verify-client-outcomes.prop.test.ts tests/zk/proof-step-not-completed.prop.test.ts tests/ui/ctm900-verifier-error-row.prop.test.ts` lists all three files, `git status --short src` prints nothing, and `npx vitest run tests/zk/verify-client-outcomes.prop.test.ts tests/zk/proof-step-not-completed.prop.test.ts tests/ui/ctm900-verifier-error-row.prop.test.ts` exits non-zero with assertion failures that name the new tests, and not with an import or syntax error.

  - [~] 1.2 Implement the three-way outcome in `verify-client.ts` and `verifier.ts`
    - In `src/zk/verifier.ts` add `export type ProofOutcome = 'valid' | 'invalid' | 'not_completed'`, change `ProofVerifier` to resolve `ProofOutcome`, and export `NOT_COMPLETED_DETAIL = 'PROOF CHECK NOT COMPLETED'`. Add the optional `notCompleted` text to the shared `VERIFY_DETAILS` record type and set it on `PROOF` only.
    - Make `proofStep` return a `ProofOutcome`: wrap the call in `try`/`catch`, return the answer only when it is exactly `'valid'` or `'invalid'`, and return `'not_completed'` for a throw, a rejection or any other value.
    - Take `PROOF` out of the generic `checks` loop in `createVerifier`. Keep `SIGNATURE`, `DIGEST_MATCH`, `POLICY` and `CIRCUIT` in the loop with their order and results unchanged. Record `PROOF` from the outcome: `ok` only for `'valid'`, `detail` from `NOT_COMPLETED_DETAIL` for `'not_completed'` and from `VERIFY_DETAILS.PROOF` otherwise. Keep the outer `try`/`catch` that falls back to a rejected report.
    - In `src/zk/verify-client.ts` change `VERIFY_TIMEOUT_MS` to `120_000`. Change the per-run `resolve` callback to take a `ProofOutcome`. Map a `verified` event to `'valid'` or `'invalid'` by its `valid` flag, and a `failed` event, a port error, a `post` throw and a timeout to `'not_completed'`. Update the header comment, which says that a failure and a timeout mean "not valid". Keep `isWorkerEvent` and the `pending` map as they are and carry no error text or timer value.
    - Do not touch `worker-core.ts`, `worker-protocol.ts`, `worker-backend.ts` or any other file under `src/zk` or `src/ledger`. If the fix seems to need one, stop and ask huynh.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_
    - **Done when:** `npx vitest run tests/zk` ends with a passing summary line that includes `verify-client-outcomes`, `proof-step-not-completed`, `verifier-order`, `verifier-compare` and `verify-never-throws`, and `git status --short src` lists only `src/zk/verifier.ts` and `src/zk/verify-client.ts`.

  - [~] 1.3 Map a not-completed proof check to the CTM900 verifier error
    - In `src/ui/model/verify-flow.ts` import `NOT_COMPLETED_DETAIL` from `src/zk/verifier` and change `normalizeReport`: when the verdict is `REJECTED` and the last step is named `PROOF` with `detail === NOT_COMPLETED_DETAIL`, return `null`. Every other `REJECTED` report keeps its existing return path, so a `PROOF INVALID` report still gives `REJECTED AT PROOF`. Compare with `===` only, and never copy or display the text.
    - Update the header comment of `normalizeReport`, which says the `detail` of a step is never read, to name this one exception.
    - Leave `src/ui/model/screens/ctm900.ts` unchanged. Its `outcome.kind === 'error'` branch already shows `MESSAGES.VERIFIER_ERROR`. If `ctm900_verifier_error_row` shows that a change there is needed, make the smallest one and say so in the report.
    - _Requirements: 2.7, 2.8, 2.9, 2.10_
    - **Done when:** `npx vitest run tests/ui tests/zk` ends with a passing summary line that includes `ctm900-verifier-error-row` and the unchanged `verdict_row_inverse`, and `npm run typecheck` exits 0.

  - [~] 1.4 Rebuild, deploy a draft, run the final checks and make the final commit
    - Run `npm run build`.
    - If `.netlify/netlify.toml` exists, delete it. Then run `npx --yes netlify-cli@27.20.1 status`. It must show the project `cryptterm`. If it shows any other project, or none, STOP and ask huynh. Do not write the account name or email from this output into any file.
    - Run `npx --yes netlify-cli@27.20.1 deploy --dir dist --no-build`. Never add `--prod` or `--build`. Report the new Draft_URL.
    - Mark tasks 0, 1.1, 1.2 and 1.3 completed in `tasks.md`. Commit by name with the message `Fix false PROOF INVALID verdict on a proof check that did not finish`: `src/zk/verify-client.ts`, `src/zk/verifier.ts`, `src/ui/model/verify-flow.ts`, `src/ui/model/screens/ctm900.ts` (only if it changed), `tests/support/signed-bundle.ts`, `tests/zk/verifier-order.prop.test.ts`, `tests/zk/verifier-compare.prop.test.ts`, `tests/zk/verify-never-throws.prop.test.ts`, `tests/ui/verify-bad-inputs.prop.test.ts`, the three new test files, `.kiro/specs/verify-error/tasks.md` and `.kiro/specs/verify-error/tasks.meta.json`. Stage only files that changed.
    - After that commit, run each of these and quote its summary line, in this order: `npm run typecheck`, `npm test`, `npm run test:proof`, `npm run build`, `CHECK_DIST=1 npx vitest run`, `npm run check:dist-vk`, `npm run test:e2e` (local), then `BASE_URL=<new Draft_URL> npm run test:e2e` run alone with nothing else running, then `git diff --stat 3c6eb39 HEAD -- src/zk src/ledger`. Only `src/zk/verify-client.ts` and `src/zk/verifier.ts` may appear in the diff stat. Any other file means stop and ask huynh.
    - If a check fails, fix the cause, make a new commit and rerun every check from `npm run typecheck`. Never amend, never push.
    - Once every check has passed, mark 1.4 and 1 completed in `tasks.md` and commit `.kiro/specs/verify-error/tasks.md` and `.kiro/specs/verify-error/tasks.meta.json` alone with the message `Complete verify-error tasks`. Rerun `git diff --stat 3c6eb39 HEAD -- src/zk src/ledger` after it.
    - _Requirements: 1.1 to 1.8, 2.1 to 2.10, 3.1 to 3.3_
    - **Done when:** each command above printed its summary line and the report quotes all of them, the local and the Draft_URL `npm run test:e2e` both end with passing summary lines, the diff stat lists only the two allowed files, and `git log -1 --oneline` prints the last commit.

## Notes

- Tests come before implementation. After 1.1 the existing `tests/zk` and `tests/ui` suites that call the changed helpers fail on purpose until 1.2 lands.
- Design properties map to tasks: Property 1 and Property 2 are written in 1.1 and pass in 1.2. Property 3 is written in 1.1 and passes in 1.3.
- `tests/zk/verifier-compare.prop.test.ts` is the one test file beyond the design's list that needs the mechanical update. It is named in 1.1.
- The worker side (`worker-core.ts`, `worker-protocol.ts`) already sends `verified` with a boolean and `failed`. It does not change.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0"] },
    { "id": 1, "tasks": ["1.1"] },
    { "id": 2, "tasks": ["1.2"] },
    { "id": 3, "tasks": ["1.3"] },
    { "id": 4, "tasks": ["1.4"] }
  ]
}
```

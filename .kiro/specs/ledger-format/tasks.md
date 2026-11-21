# Implementation Plan: ledger-format

## Overview

This plan builds the batch format, the seeded generator, the signed digest and the signed samples, test-first. Task 0 commits the spec files. Group 1 moves `posting.ts` and `field.ts` into `src/ledger` (own commit), then builds the codec, the invariant checker and the generator. Group 2 adds the digest module and the Root_Function `batchRoot`. Group 3 adds the demo key folder, the Sample_Writer, the generated samples and `trusted-keys.ts`, the key-isolation and static-scan tests, and the save hook. Each group ends with one commit that also stages the two task-tracking files. Nothing is pushed. The order of the groups is binding, and the plan stops for Claude's review at the end of group 3.

Rules for every task:

1. Evidence before status (`structure.md`). A task is marked completed only after its "Done when" command was run in this session and the report quotes the command and its output. Never report a commit hash, file, size or output that was not produced in this session. A sub-agent's claims are verified on disk before a status changes.
2. Do not change the circuit, the Artifact, `src/zk/artifacts/` or any spike file, except the one approved move in task 1.1 (`git mv` of `posting.ts` and `field.ts`, import-path edits only). Task 2.3 adds one new file in `src/zk`. If anything else in `src/zk` must change, STOP and ask huynh.
3. Amounts are `bigint` cents. No `Number`, `parseInt` or `parseFloat` on money. No `console.*` and no network call in `src/ledger`. Test data is synthetic only.
4. Look up before writing. For WebCrypto Ed25519 and the Kiro hook file format, check the docs (Context7 or the Kiro docs) and record what was looked up in the task report. Do not write a hook file from memory. If the hook format cannot be confirmed, STOP and ask.
5. Commit policy. Stage files by name, never with `git add -A` or `git add .`. Run `git status --short` before each commit. Never amend or rewrite history. NEVER push; huynh pushes. The group-end commit also stages `.kiro/specs/ledger-format/tasks.md` and `.kiro/specs/ledger-format/tasks.meta.json`.
6. Property tests use `runProperty` from `tests/support/pbt.ts`, carry the fixed seed and `numRuns` from the design "Testing Strategy" table, and are tagged with a comment `Feature: ledger-format, Property <name>: <text>`. Every test title contains its name from the design table, so `npx vitest run tests/ledger -t <name>` selects it. When a property finds a real bug, add a regression example test and append an entry to `tests/PBT-LOG.md`.

## Tasks

- [-] 0. Commit the spec files and the two steering edits
  - Stage by name: `git add .kiro/specs/ledger-format/requirements.md .kiro/specs/ledger-format/design.md .kiro/specs/ledger-format/tasks.md .kiro/specs/ledger-format/.config.kiro .kiro/steering/structure.md .kiro/steering/tech.md`. Run `git status --short` first. Commit with the message `docs(spec): add ledger-format requirements, design and tasks`.
  - Done when: `git log -1 --oneline` shows `docs(spec): add ledger-format requirements, design and tasks` and `git status --short` shows none of those six files.
  - _Requirements: 3.5_

- [ ] 1. Group 1: format core (parse, serialize, invariants, generator)
  - Move the two files, then build `src/ledger` layout, codec, invariant checker and generator, tests first.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 1.1 Move `posting.ts` and `field.ts` to `src/ledger` (own commit)
    - Run `git mv src/zk/posting.ts src/ledger/posting.ts` and `git mv src/zk/field.ts src/ledger/field.ts`. Contents stay byte-identical apart from comments that name their own path.
    - Update import paths only, with a helper-free `sed` or edit, in 17 files. In `src/zk`: `circuit-inputs.ts`, `hash.ts`, `merkle.ts`, `prover.ts`, `spike-report.ts`, `spike-witness.ts`, `witness-builder.ts`. In tests: `tests/support/zk-arbitraries.ts` and the tests `amount-range.prop`, `circuit-inputs`, `hash-kat`, `one-cent-change.prop`, `proof/proof-tamper.prop`, `root-parity.prop`, `spike-report`, `spike-witness`, `witness-builder`.
    - Commit with the message `refactor(zk): move posting and field to src/ledger`. If the sha or any test count differs from the values below, STOP and report.
    - Done when, with output quoted: `npm run typecheck` exits 0; `npx vitest run` reports 16 files and 441 tests passed; `npm run test:proof` passes; `shasum -a 256 src/zk/artifacts/ledger_audit.json` prints `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`; `git log -1 --oneline` shows the commit; `git show --stat -M` shows the two files as renames.
    - _Requirements: 3.5_

  - [ ] 1.2 Write the format tests and `tests/support/ledger-arbitraries.ts` first
    - Create the fast-check generators for `Posting`, `Batch` and defective texts, and the four property tests under `tests/ledger/`: `roundtrip` (seed 20262001, 500 runs), `text_roundtrip` (20262002, 500), `parser_rejects_malformed` (20262003, 300), `field_range_rejected` (20262004, 300). The text for `text_roundtrip` is built field by field, not through `serializeBatch`.
    - Done when: `npx vitest run tests/ledger` fails or cannot import `src/ledger/parse`, and the output is quoted before any implementation exists.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [ ] 1.3 Implement `layout.ts`, `batch.ts`, `parse.ts`, `serialize.ts` and `invariants.ts`
    - Follow "Column layout", "Parse order" and the `BatchFormatError` code table in the design. Numbers are read by digit walk and `BigInt(str)`. Bounds come from `field.ts` with no literal copy of 2^40.
    - Done when: `npx vitest run tests/ledger` passes for the four format tests, and `npm run typecheck` exits 0 (output quoted).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1_

  - [ ] 1.4 Write the generator tests first
    - Create `generator_deterministic` (seed 20262007, 200 runs), `clean_batches_satisfy_invariants` (20262005, 200) and `violating_kinds_break_exactly_one_invariant` (20262006, 200) under `tests/ledger/`. Cover the three fixed error messages and the salt range.
    - Done when: `npx vitest run tests/ledger` fails or cannot import `src/ledger/generate`, output quoted before the implementation exists.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 1.5 Implement `prng.ts` and `generate.ts`
    - Follow "PRNG", "Draw order" and "Per kind" in the design. The `generate.ts` header states that seeded salts are for demo determinism and are not random. No `Math.random`, no clock.
    - Done when: `npx vitest run tests/ledger` passes for all seven property tests, and `npm run typecheck` exits 0 (output quoted).
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 1.6 Commit group 1
    - Stage by name the files of tasks 1.2 to 1.5 plus `.kiro/specs/ledger-format/tasks.md` and `.kiro/specs/ledger-format/tasks.meta.json`. Run `git status --short` first. Message: `feat(ledger): batch format, parser, serializer and seeded generator`.
    - Done when: `git log -1 --oneline` shows that message and `git status --short` shows no change to the files this task staged.
    - _Requirements: 1.1, 2.1, 4.1_

- [ ] 2. Group 2: digest and root
  - Add the signed digest message and verifier in `src/ledger`, and `batchRoot` in `src/zk`.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_

  - [ ] 2.1 Write the digest tests first
    - Create `digest_message_unambiguous` (seed 20262008, 500 runs), `digest_tamper_detected` (20262009, 200) and `verify_digest_never_throws` (20262010, 300) under `tests/ledger/`. The tamper test signs with an ephemeral key made in the test and never uses the Demo_Key. Look up WebCrypto Ed25519 first (rule 4).
    - Done when: `npx vitest run tests/ledger` fails or cannot import `src/ledger/digest`, output quoted before the implementation exists.
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

  - [ ] 2.2 Implement `src/ledger/digest.ts`
    - `digestMessage`, `SignedDigest` and `verifyDigest` as in the design "Digest" section. `crypto.subtle` verify only. No `subtle.sign` and no key generation anywhere in `src/`.
    - Done when: `npx vitest run tests/ledger` passes for the three digest tests, and `npm run typecheck` exits 0 (output quoted).
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_

  - [ ] 2.3 Implement `src/zk/batch-root.ts` with a small example test
    - New file only. Import `Batch` from `src/ledger` and reuse `buildCircuitInputs`; no hash, padding or leaf-encoding logic of its own. Add `tests/zk/batch-root.test.ts` (uses `Hasher` from `tests/support/zk-env.ts`): root equals `buildCircuitInputs(...).merkleRoot` for one generated batch, and an amount of 2^40 throws `FieldRangeError`. The full `samples_verify_and_roots` test comes in group 3.
    - Done when: `npx vitest run tests/zk/batch-root.test.ts` passes and `npm run typecheck` exits 0 (output quoted).
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 2.4 Commit group 2
    - Stage by name the files of tasks 2.1 to 2.3 plus `tasks.md` and `tasks.meta.json` of this spec. Run `git status --short` first. Message: `feat(ledger): signed digest message, verifyDigest and batch root`.
    - Done when: `git log -1 --oneline` shows that message and `git status --short` shows no change to the files this task staged.
    - _Requirements: 5.1, 6.1_

- [ ] 3. Group 3: samples, key isolation, hook
  - Add the demo key folder, the Sample_Writer, the signed samples, the isolation and scan tests, and the save hook.
  - _Requirements: 3.4, 3.5, 4.8, 5.1, 5.2, 5.3, 5.4, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2_

  - [ ] 3.1 Write the example tests first
    - Create under `tests/ledger/`: `gen_samples_missing_key`, `samples_reproducible` (temporary output directory, checks stdout form), `samples_verify_and_roots` (includes the `FieldRangeError` case and the invariant results per kind), `no_private_key_in_src`, `ledger_static_scan`, `ledger_hook_config`. The two sample tests use `Hasher` from `tests/support/zk-env.ts`.
    - Done when: `npx vitest run tests/ledger` shows these six tests failing because `scripts/gen-samples.ts`, the key folder, the samples or the hook do not exist yet (output quoted, none skipped).
    - _Requirements: 3.4, 3.5, 4.8, 5.1, 5.2, 5.3, 5.4, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2_

  - [ ] 3.2 Create `scripts/demo-key/`
    - `make-demo-key.ts` (one-off, refuses to overwrite an existing key file), the key file `DEMO_ONLY_core_ledger_key.json`, and `README.md` that says DEMO ONLY, says the key is public by design, and says seeded salts are for demo determinism and are not random.
    - Done when: `ls scripts/demo-key` lists the three files, and `npx vitest run tests/ledger -t no_private_key_in_src` passes (output quoted).
    - _Requirements: 4.8, 7.1, 7.2, 7.3_

  - [ ] 3.3 Write `scripts/gen-samples.ts` and generate the samples
    - Follow "Samples and Sample_Writer" in the design. Export `generateSamples(...)` plus a thin command-line wrapper. Run it, which writes `public/samples/*` and `src/ledger/trusted-keys.ts`. Run it a second time and compare.
    - Done when: `shasum -a 256 public/samples/* src/ledger/trusted-keys.ts` printed after run 1 and after run 2 is identical (both outputs quoted), and `npx vitest run tests/ledger` passes for `gen_samples_missing_key`, `samples_reproducible`, `samples_verify_and_roots` and `ledger_static_scan`.
    - _Requirements: 5.2, 6.4, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 3.4 Create the save hook in `.kiro/hooks/`
    - Look up the Kiro hook file format first (rule 4) and record the source. The design names `.kiro/hooks/ledger-save.kiro.hook`; if the docs give another name or format, STOP and ask. The hook runs on save of files under `src/ledger/` and `src/zk/` and runs `npx vitest run tests/ledger tests/zk` with `tests/zk/proof` excluded.
    - Done when: `ls .kiro/hooks` lists the hook file and `npx vitest run tests/ledger -t ledger_hook_config` passes (output quoted).
    - _Requirements: 9.1, 9.2_

  - [ ] 3.5 Run everything, commit group 3 and hand over
    - Run `npm run typecheck`, `npx vitest run` (with the new tests), `npm run test:proof`, and `npx vitest run tests/ledger -t "ledger_static_scan|no_private_key_in_src"`. Quote each summary line. Stage by name the files of tasks 3.1 to 3.4, `public/samples/*`, `src/ledger/trusted-keys.ts`, plus `tasks.md` and `tasks.meta.json` of this spec. Run `git status --short` first. Message: `feat(ledger): signed samples, demo key and save hook`.
    - Done when: the four commands pass with output quoted, `git log -1 --oneline` shows that message and `git status --short` shows no change to the files this task staged. Then say "STOP: hand over to Claude for review".
    - _Requirements: 3.4, 7.3, 8.3, 9.1_

## Notes

- Stop points: task 1.1 (sha or test count differs), task 3.4 (hook format unknown or name differs from the design), task 2.1 (WebCrypto Ed25519 unusable in the test runtime), any needed change in `src/zk` beyond 1.1 and the new file in 2.3, and the end of task 3.5.
- `nargo` and `bb` are not needed for this spec. The Hasher tests use the pinned `bb.js` single-thread setup from `tests/support/zk-env.ts`.
- `tests/zk/proof` is excluded from the save hook. `npm run test:proof` runs it on request only.
- Tasks marked completed keep the evidence rule: no status change without a quoted command and output from this session.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0"] },
    { "id": 1, "tasks": ["1.1"] },
    { "id": 2, "tasks": ["1.2"] },
    { "id": 3, "tasks": ["1.3"] },
    { "id": 4, "tasks": ["1.4"] },
    { "id": 5, "tasks": ["1.5"] },
    { "id": 6, "tasks": ["1.6"] },
    { "id": 7, "tasks": ["2.1"] },
    { "id": 8, "tasks": ["2.2"] },
    { "id": 9, "tasks": ["2.3"] },
    { "id": 10, "tasks": ["2.4"] },
    { "id": 11, "tasks": ["3.1"] },
    { "id": 12, "tasks": ["3.2"] },
    { "id": 13, "tasks": ["3.3"] },
    { "id": 14, "tasks": ["3.4"] },
    { "id": 15, "tasks": ["3.5"] }
  ]
}
```

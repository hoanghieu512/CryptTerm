# Implementation Plan: zk-spike

## Overview

This plan builds the real `ledger_audit` circuit test-first, hands it to huynh for a soundness review, commits the compiled Artifact and the vendored SRS, proves in a Web Worker on a temporary spike page, and deploys a non-production build so that huynh can measure the two gates. The spec files are committed before task 1.1 and each group except group 3 ends with its own commit (see the commit policy below), which from group 2 on also carries the two task-tracking files `tasks.md` and `tasks.meta.json`; nothing is pushed. The order of the ten top-level groups is binding. Each group starts only after the previous one is done.

Rules that apply to every task:

- Run `nargo` as `PATH="$HOME/.nargo/bin:$PATH" nargo ...` from `circuits/ledger_audit` (`cd circuits/ledger_audit && ...`), because `nargo` 1.0.0 has no `--program-dir`. `bb` is `~/.bb/bb`.
- Lookup first. Before writing any Noir, `Nargo.toml`, `noir_js` or `bb.js` code or configuration, look up each API in Context7 (`/noir-lang/noir`, `/websites/noir-lang`), in the tagged `v1.0.0` source, or in the published package source and types. Do not write from memory. Record one row per lookup (topic, source, version) in the "Lookups" section of `docs/spike-results.md`. Where Context7 and the npm registry disagree on a package name or version, the registry wins and a dated entry goes into the version quirks log in `.kiro/steering/noir.md`.
- No browser automation tool is installed or run. No `public/_headers` is created. No signing code or private key is added. No batch data reaches any network request or `console.*`.
- Commit policy, part 1 (commit points). Before task 1.1 (task 0), commit the spec files (`.kiro/specs/zk-spike/`) and the two existing steering edits (`.kiro/steering/security.md` and `.kiro/steering/tech.md`) with the message "docs(spec): add zk-spike requirements, design and tasks". At the end of each group except group 3, after that group's "Done when" checks pass, commit that group's files with a conventional commit message that names the group (the last sub-task of each group, "Commit group N files"; for example "feat(circuit): ledger_audit constraints and 20 nargo tests" for group 2). The group 2 commit happens BEFORE the soundness gate (group 3), so the review has a commit hash. Group 3 changes no files and has no commit. Tasks 4.6 and 5.6 stay as written.
- Commit policy, part 2 (how to commit). Stage files by name, never with `git add -A` or `git add .`. Run `git status --short` before each commit and commit only the files that belong to the group, plus the two task-tracking files named in part 4. Ignored output such as `node_modules/`, `dist/` and `circuits/**/target/` stays out. Make no commit when a "Done when" check of the group failed. A group's own files exclude the files already committed by tasks 4.6 or 5.6; the group-end commit stages the remaining group files and the two tracking files (part 4). If no group file remains after tasks 4.6 or 5.6, the tracking files still go in that commit.
- Commit policy, part 3 (history). Never push; huynh pushes. Never amend, rebase, force or rewrite history, and never skip hooks. A fix after a commit goes in a new commit.
- Commit policy, part 4 (task tracking files). Every group-end commit task (2.11, 4.7, 5.7, 6.13, 7.16, 8.6, 9.9 and 10.9) also stages, by name, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`, in addition to the group's own files. This starts with group 2. The group 2 commit also carries the status changes left uncommitted since group 1 (group 1 and task 1.7 marked completed).
  - `tasks.meta.json` is tracked and is never added to `.gitignore`.
  - The two files change whenever a task status changes. The orchestrator marks a commit task in progress before it runs, so the committed `tasks.md` shows that commit task as in progress; the completion marks written after a commit land in the next group-end commit. That is expected and is not a failure of the commit task's done check.
  - The mid-group commits in tasks 4.6 and 5.6 stage only the Artifact files and the SRS files, as written (no tracking files).
  - Task 0 and task 1.7 are already done and stay as written.
- Do not edit `requirements.md`, `design.md`, `.config.kiro` or any steering file other than `.kiro/steering/noir.md`, except task 10.10, which syncs `design.md` with the path-rewrite Artifact (huynh's decision).
- Property tests are required, carry a fixed seed in the source, and are tagged with a comment `Feature: zk-spike, Property <n>: <text>`. When a property finds a real bug, add a regression example test and append an entry to `tests/PBT-LOG.md` (date, property name, seed, shrunk counterexample, root cause, fix).

## Tasks

- [x] 0. Commit the spec files and the steering edits
  - Bookkeeping task before task 1.1. Run `git status --short` first and confirm the only changes are `.kiro/specs/zk-spike/` and the two steering edits `.kiro/steering/security.md` and `.kiro/steering/tech.md`. If anything else is changed, leave it out and mention it in the report.
  - Stage by name: `git add .kiro/specs/zk-spike/requirements.md .kiro/specs/zk-spike/design.md .kiro/specs/zk-spike/tasks.md .kiro/specs/zk-spike/.config.kiro .kiro/steering/security.md .kiro/steering/tech.md`. Commit with the message `docs(spec): add zk-spike requirements, design and tasks`. Do not push.
  - Done when: `git log --oneline -1` shows `docs(spec): add zk-spike requirements, design and tasks` and `git status --short` shows no remaining change under `.kiro/specs/zk-spike/`, `.kiro/steering/security.md` or `.kiro/steering/tech.md`.
  - _Requirements: 1.1_

- [x] 1. Toolchain check, dependency pins and Results_Document skeleton
  - Confirm the installed toolchain, add the five pinned dependencies, test the pins, and create `docs/spike-results.md` with its headings and an empty gate table.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 13.1, 13.7_

  - [x] 1.1 Check the installed toolchain versions
    - Run `PATH="$HOME/.nargo/bin:$PATH" nargo --version`, `~/.bb/bb --version`, `node --version` and `npm --version`. Compare each with the pin table in `.kiro/steering/noir.md` (`nargo` 1.0.0, `bb` 6.0.0). Keep the full unmodified output for task 1.5.
    - If `nargo` is not installed or its version is not `1.0.0`, STOP before writing any circuit code and report to huynh the installed version (or that `nargo` is missing) and the expected version `1.0.0`.
    - Done when: the three-line `nargo --version` output shows `nargo version = 1.0.0` and `~/.bb/bb --version` prints `6.0.0`.
    - Recorded in: Results_Document header section (task 1.5).
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Check the five packages against the npm registry
    - Run `npm view <package> dist-tags` and `npm view <package>@<pinned version> version dist.tarball` for `@noir-lang/noir_js`, `@noir-lang/acvm_js`, `@noir-lang/noirc_abi`, `@noir-lang/types` (pin `1.0.0`) and `@aztec-foundation/bb.js` (pin `6.0.0`). The registry is authoritative over Context7.
    - Check that `@aztec/bb.js` is not on the dependency list and will not be installed.
    - If a package name or the pinned version does not exist, leave that package out of `package.json` and STOP: report the package name, the pinned version and the registry result to huynh.
    - Done when: all five name and version pairs return the pinned version. The `latest` tag of `@aztec-foundation/bb.js` is expected to read 6.1.0 and the pin stays 6.0.0.
    - Recorded in: Results_Document header section (task 1.5).
    - _Requirements: 1.5, 1.6, 1.7_

  - [x] 1.3 Add the pinned dependencies and run `npm ls`
    - Run `npm install --save-exact @noir-lang/noir_js@1.0.0 @noir-lang/acvm_js@1.0.0 @noir-lang/noirc_abi@1.0.0 @noir-lang/types@1.0.0 @aztec-foundation/bb.js@6.0.0`. Edit `package.json` and `package-lock.json` through npm only.
    - Open `package.json` and confirm the five entries read exactly `1.0.0` and `6.0.0` with no `^`, `~`, `latest`, range operator or tag.
    - Run `npm ls @noir-lang/noir_js @aztec-foundation/bb.js` and `npm ls @noir-lang/noir_js @noir-lang/acvm_js @noir-lang/noirc_abi @noir-lang/types @aztec-foundation/bb.js`. Run `npm ls @aztec/bb.js` and confirm it reports no installed package.
    - If any reported version differs from the pin table, or any package is reported missing, invalid or extraneous, STOP before writing code that uses these packages and report the package name, the reported version and the pinned version to huynh.
    - Done when: `npm ls` shows the five packages at the pinned versions and `@aztec/bb.js` is absent.
    - Recorded in: Results_Document header section (task 1.5).
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.7_

  - [x] 1.4 Write `tests/zk/pins.test.ts`
    - Example test, runs under `npm test`. Read `package.json`; assert each of the five pins matches `/^\d+\.\d+\.\d+$/` and equals the required version (`1.0.0` for the four `@noir-lang` packages, `6.0.0` for `@aztec-foundation/bb.js`), and that `@aztec/bb.js` is in neither `dependencies` nor `devDependencies`.
    - Done when: `npx vitest run tests/zk/pins.test.ts` exits 0.
    - _Requirements: 1.4, 1.7_

  - [x] 1.5 Create the Results_Document skeleton and record the toolchain output
    - Create `docs/spike-results.md` with these sections in order: header (deploy URL and deploy date left empty, version table, "Toolchain check output"), "Gate table", "Cold_Run procedure", "Tests written first", "Lookups", "Invalid-witness report", "Spike-only files", "Browser steps for huynh".
    - Under "Toolchain check output" paste the full unmodified output of `nargo --version`, `~/.bb/bb --version`, `node --version`, `npm --version`, both `npm ls` commands from task 1.3, and the `npm view` results from task 1.2. Fill the version table rows for `nargo`, the four `@noir-lang` packages, `@aztec-foundation/bb.js`, Vite and Node from that output.
    - Create the "Gate table" with the two data rows (Normal_Gate, Throttled_Gate) and these columns: target, Cold_Run total (ms), WASM INIT (ms), WITNESS PREP (ms), EXECUTE (ms), PROVE (ms), VERIFY (ms), proof size (bytes), Chrome version, machine, pass or fail. Leave every measured cell and the pass or fail cell empty.
    - Under "Lookups" add one row per entry of the design's "Lookup register" (L1 to L14, L16 and E-1 to E-7), each with topic, source and version, as a table.
    - Done when: the file has all eight headings, a two-row gate table with empty measured cells, and a Lookups table.
    - Recorded in: `docs/spike-results.md`.
    - _Requirements: 1.1, 1.10, 13.1, 13.3, 13.7, 13.8_

  - [x] 1.6 Add the first version quirks entries to `.kiro/steering/noir.md`
    - Append to the "Version quirks log" two entries dated `2026-11-19`: (a) `@aztec-foundation/bb.js` `latest` moved from 6.0.0 to 6.1.0 while the pin stays 6.0.0; (b) the Context7 libraries `/noir-lang/noir` and `/websites/noir-lang` reflect `master`, not 1.0.0, so tagged `v1.0.0` source is used where behaviour matters. Each entry names the package, the Context7 value and the registry value where applicable.
    - Done when: the two entries are present in `.kiro/steering/noir.md` and no other part of that file changed.
    - Recorded in: `.kiro/steering/noir.md`.
    - _Requirements: 1.8_

  - [x] 1.7 Commit group 1 files
    - Run `git status --short`. Stage by name: `package.json`, `package-lock.json`, `tests/zk/pins.test.ts`, `docs/spike-results.md` and `.kiro/steering/noir.md`. Commit with the message `chore(deps): pin noir_js and bb.js, add toolchain check and results skeleton`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the five files above. No commit is made if a "Done when" check of tasks 1.1 to 1.6 failed.
    - _Requirements: 1.4, 1.7, 13.1_

- [x] 2. Circuit package, tests written first, constraints, and all 20 `nargo test` cases passing
  - Build `circuits/ledger_audit` with the 13 required tests against a constraint-free `main`, save the failing run, add the ten constraints, then add the seven extension tests, so the saved first run shows exactly eight failures and five passes.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.4, 3.9, 3.11, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19_

  - [x] 2.1 Create the Noir package skeleton
    - Create `circuits/ledger_audit/Nargo.toml` (`[package]` name `ledger_audit`, type `bin`, `authors = [""]`, `compiler_version = "=1.0.0"`, no `[dependencies]`), `circuits/ledger_audit/src/main.nr` and `circuits/ledger_audit/src/posting.nr`. Leave `circuits/ledger_audit/.gitkeep` as it is.
    - `main.nr`: `global N: u32 = 64`, `global DEPTH: u32 = 6` with `static_assert(1 << DEPTH == N)`, `global AMOUNT_BOUND: u64 = 1099511627776`, and `main(merkle_root: pub Field, record_count: pub u32, limit_cents: pub u64, postings: [Posting; N])` with no return value and an empty body. `64` appears only in the definition of `N`.
    - `posting.nr`: `Posting { record_id: Field, account: Field, side: u8, amount: u64, review_flag: u8, salt: Field }`, the side constants D = 0 and C = 1, the flag constants N = 0 and Y = 1, `padding_posting()` (all six fields zero), `is_padding()` and `leaf_fields()` returning `[record_id, account, side as Field, amount as Field, review_flag as Field, salt]`.
    - Add the `test:circuit` script to `package.json`: `cd circuits/ledger_audit && nargo test`.
    - Lookup first, recorded in "Lookups": struct field visibility, `global` integer constants, `static_assert`, `pub` parameters, `compiler_version` syntax in `Nargo.toml` (U1).
    - Done when: `cd circuits/ledger_audit && PATH="$HOME/.nargo/bin:$PATH" nargo compile` reaches the end of compilation with no error. Unused-variable warnings are expected.
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 4.9, 1.9, 1.10_

  - [x] 2.2 Write the hash and Merkle modules
    - Create `circuits/ledger_audit/src/hash.nr` with `node_hash(left, right)` (one `std::hash::poseidon2_permutation` of `[left, right, 0, 2 * 2^64]`, element 0) and `leaf_hash(f: [Field; 6])` (permute `[f0, f1, f2, 6 * 2^64]`, then permute `[s0 + f3, s1 + f4, s2 + f5, s3]`, element 0), per decision D3. No `noir-lang/poseidon` dependency.
    - Create `circuits/ledger_audit/src/merkle.nr` with `compute_root(leaves: [Field; N])`: leaf index `i` is position `i` at level 0, parent `j` at level `l + 1` is `node_hash(level_l[2j], level_l[2j + 1])`, six reductions to one root. Prefer one numeric-generic `halve` helper with `static_assert(IN == 2 * OUT, ...)`; if inference does not work in 1.0.0, use the six helpers `halve_64`, `halve_32`, `halve_16`, `halve_8`, `halve_4`, `halve_2`.
    - Add `mod hash;` and `mod merkle;` to `main.nr`.
    - Lookup first, recorded in "Lookups": `std::hash::poseidon2_permutation` signature in Noir 1.0.0 (L9), numeric generics and array-length generics (U1).
    - Append a quirks log entry dated `2026-11-19` to `.kiro/steering/noir.md`: the Noir 1.0.0 stdlib exposes only `poseidon2_permutation` publicly, so the sponge is written in-repo.
    - Done when: `nargo compile` reaches the end of compilation with no error.
    - _Requirements: 2.3, 3.1, 3.2, 3.4, 3.9, 1.9, 1.10_

  - [x] 2.3 Write `src/test_support.nr`
    - Create `circuits/ledger_audit/src/test_support.nr` with `LIMIT: u64 = 1000000`, `base_postings(real: u32) -> [Posting; N]` (slots `2k` and `2k + 1` are a debit and a credit of the same amount `100000 + k`, `review_flag` 0, `record_id = 100000 + i`, `account = 1000000000000000 + i`, `salt = 7000000 + i`, slots from `real` upward are `padding_posting()`), `root_of(postings)` (leaves through `leaf_hash`, then `compute_root`) and `with_slot(postings, i, posting)`.
    - Add `mod test_support;` to `main.nr`.
    - Lookup first, recorded in "Lookups": array mutation and loop syntax in Noir 1.0.0.
    - Done when: `nargo compile` reaches the end of compilation with no error.
    - _Requirements: 5.6, 5.13, 1.9, 1.10_

  - [x] 2.4 Write the 13 required tests in `src/tests.nr`
    - Create `circuits/ledger_audit/src/tests.nr` and `mod tests;` in `main.nr`. Tests take no arguments and call `main(root_of(p), count, LIMIT, p)`.
    - Eight `_fails` tests, each with `#[test(should_fail_with = "<message>")]` and its own message, the message of the one constraint it targets: `unbalanced_by_one_cent_fails` (`DEBITS NOT EQUAL TO CREDITS`), `over_limit_unflagged_fails` (`OVER LIMIT WITHOUT REVIEW FLAG`), `amount_at_2_pow_40_fails` (`AMOUNT OUT OF RANGE`), `nonzero_padding_fails` (`PADDING SLOT NOT NEUTRAL`), `wrong_root_fails` (`MERKLE ROOT MISMATCH`), `record_count_0_fails` (`RECORD COUNT BELOW 1`), `record_count_65_fails` (`RECORD COUNT ABOVE CAPACITY`), `limit_at_2_pow_40_fails` (`LIMIT OUT OF RANGE`). Five `_passes` tests with `#[test]`: `valid_batch_passes`, `over_limit_flagged_passes`, `amount_2_pow_40_minus_1_passes`, `amount_equal_limit_unflagged_passes`, `record_count_64_passes`.
    - Build each witness exactly as the design's test table and Requirements 5.6 to 5.18 describe, so that only the targeted constraint can reject it: `unbalanced_by_one_cent_fails` changes slot 0 by one cent and recomputes the root; `over_limit_unflagged_fails` has slot 0 debit `LIMIT + 1` flag N and slot 1 credit `LIMIT + 1` flag Y; `amount_at_2_pow_40_fails` has slot 0 debit 2^40 flag Y, slot 1 credit 2^40 - 1 flag Y, slot 2 credit 1; `nonzero_padding_fails` sets slot 10 to a debit of amount 5 and slot 1 credit to amount + 5; `wrong_root_fails` uses `root_of(p) + 1`; `record_count_0_fails` uses 64 padding slots and count 0; `record_count_65_fails` uses `base_postings(64)` and count 65; `limit_at_2_pow_40_fails` uses `LIMIT = 2^40`.
    - Lookup first, recorded in "Lookups": `#[test]`, `#[test(should_fail_with = "...")]` and `#[test(should_fail)]` syntax and substring-matching behaviour in `nargo` 1.0.0 (L10).
    - Run `cd circuits/ledger_audit && PATH="$HOME/.nargo/bin:$PATH" nargo test --list-tests`.
    - Done when: `nargo compile` succeeds and `--list-tests` prints exactly the 13 names above, no others.
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.18, 1.9, 1.10_

  - [x] 2.5 Run the tests against the constraint-free skeleton and save the output
    - Run `cd circuits/ledger_audit && PATH="$HOME/.nargo/bin:$PATH" nargo --version` and then `PATH="$HOME/.nargo/bin:$PATH" npm run test:circuit` (without `--deny-warnings`). Capture the complete unmodified output, the exit status and the date.
    - Expected: exactly the eight `_fails` tests reported failed, the five `_passes` tests reported passed, exit status non-zero. The extension tests must not exist yet.
    - If any `_fails` test passes, correct that test so it fails against the skeleton, and repeat the run before adding any constraint. If a test does not compile, fix it first.
    - Save the output of the final accepted run under "Tests written first" in `docs/spike-results.md`, together with `nargo --version` and the date, before adding any constraint.
    - Done when: the saved output shows eight failed and five passed.
    - Recorded in: Results_Document "Tests written first".
    - _Requirements: 5.3, 5.4, 5.19_

  - [x] 2.6 Add the ten constraints to `main`
    - In `circuits/ledger_audit/src/main.nr`, add the assertions in this order, each with a unique literal message (no f-strings, no message that is a substring of another): (1) `record_count >= 1` `RECORD COUNT BELOW 1`; (2) `record_count <= N` `RECORD COUNT ABOVE CAPACITY`; (3) `limit_cents < AMOUNT_BOUND` `LIMIT OUT OF RANGE`; then per slot over all 64 slots (4) `side <= 1` `SIDE NOT D OR C`, (5) `review_flag <= 1` `FLAG NOT Y OR N`, (6) `amount < AMOUNT_BOUND` `AMOUNT OUT OF RANGE`, (7) for `i >= record_count` all six fields zero `PADDING SLOT NOT NEUTRAL`; then (8) `compute_root` over all 64 leaves equals `merkle_root` `MERKLE ROOT MISMATCH`; (9) `debit_total == credit_total` with `u64` sums over all 64 slots `DEBITS NOT EQUAL TO CREDITS`; (10) for `i < record_count` `(amount <= limit_cents) | (review_flag == 1)` `OVER LIMIT WITHOUT REVIEW FLAG`.
    - Range checks run before any sum. No `unconstrained` function, no signed integer, no float, no field-element comparison on an unchecked value.
    - Lookup first, recorded in "Lookups": `assert` with a message, `u64` overflow behaviour, loops with a comparison on a loop index and `u32`, conditional accumulation syntax.
    - Done when: `nargo compile` reaches the end of compilation with no error.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 2.8, 1.9, 1.10_

  - [x] 2.7 Run the 13 required tests with the constraints and check message matching
    - Run `PATH="$HOME/.nargo/bin:$PATH" npm run test:circuit`.
    - Check U2: temporarily swap the expected messages of two `_fails` tests, confirm both now fail, then restore them and rerun. If `should_fail_with` cannot match an assertion message in 1.0.0 for a test, declare that test with `#[test(should_fail)]` and record the reason in "Lookups" of `docs/spike-results.md`.
    - Done when: all 13 named tests pass, none fail, none skipped, exit status 0.
    - Recorded in: Results_Document "Lookups" for any `#[test(should_fail)]` fallback.
    - _Requirements: 5.2, 5.5, 4.10, 2.8_

  - [x] 2.8 Add the seven extension tests
    - Add to `circuits/ledger_audit/src/tests.nr` only now, after the written-first output is saved: `side_value_2_fails` (`SIDE NOT D OR C`), `review_flag_value_2_fails` (`FLAG NOT Y OR N`), `padding_nonzero_salt_fails` (`PADDING SLOT NOT NEUTRAL`; `base_postings(10)`, count 10, slot 10 with `salt` 1 and every other field 0, balanced, root of the supplied slots), and the four known-answer tests `leaf_hash_matches_bb_js` (`LEAF_A`, `LEAF_B`), `node_hash_matches_bb_js` (`NODE_A`, `NODE_SMALL`), `padding_leaf_matches_bb_js` (`PAD_LEAF`) and `empty_root_matches_bb_js` (`EMPTY_ROOT`), with the provisional vectors from the design's Q1 table. Each failing extension test rejects only its own constraint (the root is the root of the supplied slots).
    - Run `PATH="$HOME/.nargo/bin:$PATH" npm run test:circuit`.
    - If a known-answer test fails, fix the sponge in `hash.nr` first. If the permutation itself differs between the ACVM and `bb.js` (U3), STOP: report to huynh the variants tried, the input vectors, the output of each side and the package versions, and adopt no other hash until huynh approves it.
    - Done when: 20 tests pass, none fail, none skipped, exit status 0.
    - _Requirements: 3.2, 3.3, 3.11, 2.8, 4.5, 1.9, 1.10_

  - [x] 2.9 Record the final run and inspect the circuit source
    - Run `PATH="$HOME/.nargo/bin:$PATH" npm run test:circuit` and `cd circuits/ledger_audit && PATH="$HOME/.nargo/bin:$PATH" nargo compile`. Save the final `nargo test` output, exit status and date as a "Final run (all constraints, 20 tests)" subsection under "Tests written first" in `docs/spike-results.md`.
    - Inspect the source under `circuits/ledger_audit/src/` for: no `unconstrained` function; no `i8`, `i16`, `i32`, `i64` or float type for `amount`, `limit_cents` or `record_count`; `N` is the only capacity constant and the literal 64 appears nowhere else. Record the three findings in the Results_Document under "Tests written first".
    - Done when: `nargo compile` exits 0 with zero errors, all 20 tests pass, and the inspection findings are recorded.
    - Recorded in: Results_Document "Tests written first".
    - _Requirements: 2.1, 2.2, 4.8, 4.9, 5.5_

  - [x] 2.10 Record the circuit-side settled choices in `noir.md`
    - Fill the "Settled choices" section of `.kiro/steering/noir.md` with: the Hash_Variant name (Poseidon2 on BN254 through `poseidon2_permutation`, state width 4, rate 3, initial capacity `len * 2^64`, output `state[0]`, the `bb.js` `poseidon2Hash` convention) and its parameters; the Leaf field order `[record_id, account, side, amount, review_flag, salt]`; the field encoding of `record_id` and `account` (unsigned integer 0 to 2^64 - 1, 32-byte big-endian in the hash) and of `salt` (0 to 2^248 - 1); the Padding_Posting (all six fields zero, leaf `PAD_LEAF`); the numeric values `side` D = 0 and C = 1 and `review_flag` N = 0 and Y = 1; the Merkle layout (leaf index `i` at position `i`, left is `2j`, right is `2j + 1`, root at level 6); the inner-node hash; the Noir integer types per value; the six known-answer vectors in full.
    - Compute the five intermediate all-padding levels with a throwaway `node --input-type=module -e` run from the repository root using `bb.js` `poseidon2Hash` (no repo file is created) and record them in full.
    - Done when: every item above is present in `.kiro/steering/noir.md`, and the six vectors there equal the values in `tests.nr`.
    - Recorded in: `.kiro/steering/noir.md` "Settled choices".
    - _Requirements: 3.5, 3.11, 2.6, 2.7_

  - [x] 2.11 Commit group 2 files
    - Runs after the "Done when" checks of tasks 2.1 to 2.10 pass (all 20 tests pass) and before group 3. Run `git status --short`. Stage by name: `circuits/ledger_audit/Nargo.toml`, `circuits/ledger_audit/src/main.nr`, `circuits/ledger_audit/src/posting.nr`, `circuits/ledger_audit/src/hash.nr`, `circuits/ledger_audit/src/merkle.nr`, `circuits/ledger_audit/src/test_support.nr`, `circuits/ledger_audit/src/tests.nr`, `package.json` (the `test:circuit` script), `docs/spike-results.md`, `.kiro/steering/noir.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json` (the two tracking files also carry the status changes left uncommitted since group 1: group 1 and task 1.7 marked completed). If `nargo` wrote any other non-ignored file under `circuits/ledger_audit/` (for example `Nargo.lock`), list it in the report and stage it by name only if it belongs to the package. `circuits/ledger_audit/target/` is ignored and stays out. `src/zk/artifacts/` stays untouched.
    - Commit with the message `feat(circuit): ledger_audit constraints and 20 nargo tests`. Do not push. Run `git rev-parse --short HEAD` and keep the hash for the hand-over in task 3.1.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit).
    - _Requirements: 2.8, 5.5_

- [x] 3. Checkpoint: soundness review gate
  - The circuit is complete and tested. Nothing downstream of the Artifact starts until huynh gives the written go-ahead. huynh reviews outside Kiro, and no Kiro agent is created for the review.
  - _Requirements: 4.10, 5.5, 13.9_

  - [x] 3.1 Prepare the hand-over for the soundness review
    - Confirm that `src/zk/artifacts/ledger_audit.json` and `ledger_audit.meta.json` do not exist and that the Build_Script has not been run. Confirm that task 2.11 is done and that `git status --short` shows no uncommitted change under `circuits/ledger_audit/`.
    - Assemble, in the message that ends task 3.2: (0) the group 2 commit hash from `git rev-parse --short HEAD` after the task 2.11 commit, with its subject line, so that huynh reviews a named commit; (1) the paths of `circuits/ledger_audit/Nargo.toml` and every file under `circuits/ledger_audit/src/` (`main.nr`, `posting.nr`, `hash.nr`, `merkle.nr`, `test_support.nr`, `tests.nr`); (2) the constraint table of ten assertions with message and requirement, regenerated from the final source; (3) the complete `nargo test` output with exit status, the date and the `nargo --version` output; (4) the list of each constraint with the test or tests that cover it, regenerated from the final source (constraint 1 `record_count_0_fails`, 2 `record_count_65_fails`, 3 `limit_at_2_pow_40_fails`, 4 `side_value_2_fails`, 5 `review_flag_value_2_fails`, 6 `amount_at_2_pow_40_fails` with `amount_2_pow_40_minus_1_passes` for the inclusive bound, 7 `nonzero_padding_fails` and `padding_nonzero_salt_fails`, 8 `wrong_root_fails`, 9 `unbalanced_by_one_cent_fails`, 10 `over_limit_unflagged_fails`; the hash is pinned by the four `_matches_bb_js` tests); (5) the compiler output of one `cd circuits/ledger_audit && PATH="$HOME/.nargo/bin:$PATH" nargo compile` run (output goes to the git-ignored `target/`, nothing is written to `src/zk/artifacts/`) so the under-constrained-check warnings are visible; (6) the circuit-side UNVERIFIED items with their evidence: U1 (syntax, and whether the numeric-generic helper or the six `halve_*` functions were used, and the `compiler_version` form), U2 (`should_fail_with` matching and the result of the message-swap check), U3 (the Noir sponge equals `bb.js`, shown by the known-answer tests); (7) the known coverage gap: no test sets a non-zero `record_id`, `account`, `side` or `review_flag` in a padding slot (`nonzero_padding_fails` changes only `amount`, `padding_nonzero_salt_fails` changes only `salt`).
    - Done when: the commit hash and items 1 to 7 are collected and ready to report.
    - _Requirements: 4.10, 5.5, 13.9_

  - [x] 3.2 STOP: soundness review gate, wait for huynh's go-ahead
    - The agent must stop here, report the hand-over from task 3.1, and wait for huynh's explicit written reply in the session. No later task may be started or batched with this one. Silence, a passing test run or an unrelated instruction is not a go-ahead.
    - huynh reviews the circuit outside Kiro. Do not create or invoke a soundness-reviewer agent.
    - The go-ahead is required before running the Build_Script, computing the sha256, writing Artifact_Meta or committing the Artifact. None of these happens before it.
    - The hand-over names the group 2 commit hash (task 2.11), so that huynh reviews a named commit.
    - If huynh's review requires a circuit change, return to group 2, make the change test-first where it alters a constraint, rerun all 20 tests and the known-answer tests, commit the fix as a new commit in group 2 (never an amend, rebase or other history rewrite), and pass this gate again with a new hand-over that names the new commit hash.
    - _Requirements: 4.10, 5.5, 13.9_

- [x] 4. Build_Script, Artifact and Artifact_Meta committed, with their sha256 and version tests
  - Starts only after the go-ahead in task 3.2. Compile through a script, write the Artifact and Artifact_Meta atomically, prove the output is stable, test the checksum and version, then commit the two files.
  - _Requirements: 2.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 4.1 Write `scripts/build-circuit` and the `build:circuit` script
    - Create `scripts/build-circuit` (Node ESM, no extension, `#!/usr/bin/env node`, the repo has `"type": "module"`). Steps: (1) run `nargo --version`, fail with `build-circuit: step version failed: ...` on error; (2) run `nargo compile --force` through `spawnSync` with `cwd` set to `circuits/ledger_audit` and no `--skip-underconstrained-check` or `--skip-brillig-constraints-check`; (3) read `circuits/ledger_audit/target/ledger_audit.json`, fail with `step artifact missing` if absent, check it parses and has `bytecode` and `abi`; (4) compute sha256 over the exact bytes to write; (5) write `ledger_audit.json.tmp-<pid>` and `ledger_audit.meta.json.tmp-<pid>` into `src/zk/artifacts/`, hold the old bytes in memory, `rename` both into place, restore the first file from memory if the second rename fails; (6) a `finally` block removes leftover `.tmp-*` files. Errors go to stderr as `build-circuit: step <name> failed: <reason>` with exit status 1. Nothing is written before every check passes.
    - Artifact_Meta contains exactly two keys in this order, two-space indent, trailing newline: `nargoVersion` (first line of `nargo --version`, trailing whitespace removed) and `artifactSha256` (64 lowercase hex). No timestamp, path or other value.
    - Amended after task 4.3 (huynh's decision A on U5): after reading `target/ledger_audit.json` as text and BEFORE computing the sha256 (step 4), the script rewrites the absolute source paths by TEXTUAL replacement only. It does not parse and stringify the artifact to produce the output, because the 64-bit `hash` field would lose precision. It replaces every occurrence of the absolute prefix of `circuits/ledger_audit/` (the package directory, with its trailing slash, in the exact form it appears in the JSON text, including any JSON escaping of the path) with the empty string, so `/abs/.../circuits/ledger_audit/src/main.nr` becomes `src/main.nr`. The script then FAILS (step `path rewrite`, nonzero exit, `src/zk/artifacts/` untouched, no tmp files left) if any of these holds: the output still contains the absolute repo path or the home directory path (text checks covering both the plain and the JSON-escaped form of each); the output no longer parses as JSON (the parse is only a validity check and never produces the output); the rewritten text lacks `bytecode` or `abi`; or `bytecode` or `abi` of the rewritten text differs from that of the unrewritten compile output (compare the parsed `bytecode` string and the serialized `abi` object of both texts as an assertion; this is a check, not part of the output). The Meta's `artifactSha256` is computed over the rewritten bytes.
    - Add `"build:circuit": "node scripts/build-circuit"` to `package.json`. The script finds `nargo` through `PATH` and hard-codes no path.
    - Lookup first, recorded in "Lookups": `nargo compile` options and output location in 1.0.0 (U4), Node `spawnSync`, `fs.renameSync`, `crypto.createHash`.
    - Done when: the file exists and `node --check scripts/build-circuit` reports no syntax error. Do not run the script in this task.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 1.9, 1.10_

  - [x] 4.2 Run the Build_Script and write the Artifact and Artifact_Meta
    - Run `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit`. Confirm `src/zk/artifacts/ledger_audit.json` and `src/zk/artifacts/ledger_audit.meta.json` exist, the Meta has exactly the two keys, `nargoVersion` is `nargo version = 1.0.0`, and `artifactSha256` equals `shasum -a 256 src/zk/artifacts/ledger_audit.json`.
    - Record the confirmed `nargo compile` output path (U4) in the Results_Document "Lookups" section, and the Artifact size in bytes.
    - After the 4.1 amendment, task 4.2 is re-run and its checks are repeated against the rewritten Artifact. The earlier first run contained absolute paths, was never committed, and is replaced. A `grep -c '/Users/' src/zk/artifacts/ledger_audit.json` must now find nothing for the Artifact.
    - Done when: the script exits 0 and the sha256 in the Meta equals the recomputed value.
    - Recorded in: Results_Document "Lookups".
    - _Requirements: 7.2, 7.3, 2.1_

  - [x] 4.3 Check idempotence and cross-checkout determinism
    - Run the Build_Script a second time and compare `shasum -a 256` of both files with the first run. Then copy `circuits/`, `scripts/` and `src/zk/artifacts/` into a temporary directory outside the repo with a minimal `package.json` containing `"type": "module"`, run `node scripts/build-circuit` there with `nargo` on `PATH`, and compare again.
    - If the hashes differ between runs or checkouts (U5), STOP and report to huynh the cause. The fallback (strip `file_map` and `debug_symbols`, or accept and document non-determinism) is huynh's decision. Do not edit the Artifact by hand.
    - Decision (huynh): option A. U5 is resolved by path rewriting in the Build_Script (see the amendment in task 4.1). After the amendment, task 4.3 is re-run in full: the build in the repo, a second run in the repo, and builds from TWO other directories outside the repo. All three sha256 values of the Artifact (and of the Meta) must be EQUAL and are recorded in the Results_Document "Lookups" (rows T4.3-c and following). The earlier rows T4.3-a and T4.3-b stay as the record of the failing result.
    - Done when: the Artifact and Artifact_Meta hashes are identical in all three runs. Record the result in the Results_Document under "Lookups".
    - _Requirements: 7.2, 7.5_

  - [x] 4.4 Review the failure behaviour of the Build_Script
    - Review `scripts/build-circuit` against Requirement 7.4: each failing step (nargo missing, `nargo compile` non-zero, compiled JSON missing) exits non-zero with a message naming the step, and the existing Artifact and Artifact_Meta stay byte-identical with no `.tmp-*` file left. Do one manual run with `nargo` absent from `PATH` (build the `PATH` from the directory of `node` plus `/usr/bin:/bin`, and confirm `command -v nargo` prints nothing first), compare `shasum -a 256` of both files before and after, and list `src/zk/artifacts/` for leftovers. This is a manual check; no automated test is added for it.
    - Done when: the manual run exits non-zero with `step version failed` on standard error and both files are unchanged.
    - _Requirements: 7.4_

  - [x] 4.5 Write `tests/zk/artifact.test.ts`
    - Example test, runs under `npm test`. Test 7.8: recompute the sha256 of `src/zk/artifacts/ledger_audit.json`; fail when it differs from `artifactSha256` in the Meta, when the Meta is missing, or when the value is not 64 lowercase hex characters. Test 7.9: match `nargoVersion` against `^nargo version = (\S+)$`, take the captured token whole and require it to equal `1.0.0` by string equality. Run it against the committed Meta and against a table of mutated strings that must fail: `nargo version = 1.0.0-beta.1`, `nargo version = 1.0.0+build5`, `nargo version = 1.0.1`, an empty string, a missing value, and a first line in another shape.
    - Add an example test in the same file (runs under `npm test`, no `nargo` needed) that FAILS if the committed Artifact `src/zk/artifacts/ledger_audit.json` contains the substring `/Users/`, `/home/`, or a Windows drive path (a letter followed by `:\` or `:/`, also in the JSON-escaped form `:\\`). Run it against the committed Artifact and against a table of mutated strings that must be rejected (a string with `/Users/x/proj`, with `/home/ci/work`, with `C:\\Users\\x`, and with `D:/a/b`), plus the clean text, which must be accepted. No comparison of `bytecode` and `abi` with a fresh `nargo compile` is part of the test (no `nargo` in CI). The 7.8 and 7.9 tests stay.
    - Done when: `npx vitest run tests/zk/artifact.test.ts` exits 0.
    - _Requirements: 7.2, 7.8, 7.9_

  - [x] 4.6 Check tracking and commit the Artifact and Artifact_Meta
    - Run `git check-ignore circuits/ledger_audit/target/` and confirm it reports the path as ignored. Run `git add src/zk/artifacts/ledger_audit.json src/zk/artifacts/ledger_audit.meta.json` (by name, no `git add -A`) and commit them with a message that states they are the compiled Artifact and Artifact_Meta for `nargo` 1.0.0.
    - Confirm `git ls-files src/zk/artifacts` lists both paths.
    - Done when: both paths are tracked and `circuits/ledger_audit/target/` is ignored.
    - _Requirements: 7.6_

  - [x] 4.7 Commit group 4 files
    - Before staging, create the section `## Deferred to zk-core` at the END of `docs/spike-results.md` (after "Browser steps for huynh"; keep every existing section untouched; append only). The section is created in this task and reaches the group 4 commit through `docs/spike-results.md`, which this task already stages. Add no placeholder or invented content. It contains one line, "Soundness review passed at commit 9c5e5c8 with no circuit change (huynh, outside Kiro)", then exactly these three items:
      1. "Padding canonicality: no test sets a non-zero `record_id`, `account`, `side` or `review_flag` in a padding slot (`nonzero_padding_fails` changes only `amount`, `padding_nonzero_salt_fails` changes only `salt`). Not a soundness issue: amount is forced to 0 and every leaf is bound into the signed root. Deferred to zk-core as four extra `nargo` tests (one per field, each alone in a padding slot). They do not change the compiled Artifact."
      2. "Leaf field order (`leaf_fields`) is not pinned by any `nargo` test. Root parity property P1 (group 6, task 6.9) must catch an order mismatch between TypeScript and the circuit, so P1 must build its inputs through the real Witness_Builder and run `noir.execute` on the committed Artifact. This is a requirement on P1, not a deferral."
      3. "Boundary tests `record_count = 1` and `limit_cents = 2^40 - 1` (the passing sides of constraints 1 and 3): deferred to zk-core."
    - Task 4.6 already committed the Artifact and Artifact_Meta, so this commit covers the rest of the group. Run `git status --short`. Stage by name: `scripts/build-circuit`, `package.json` (the `build:circuit` script), `tests/zk/artifact.test.ts`, `docs/spike-results.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`. Do not stage `src/zk/artifacts/ledger_audit.json` or `src/zk/artifacts/ledger_audit.meta.json` here; if either shows as changed, the Build_Script output changed after task 4.6, so stop and report it instead of committing. Commit with the message `feat(zk): Build_Script with artifact checksum and nargo version tests`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit). Additionally, `docs/spike-results.md` contains the `## Deferred to zk-core` section with the review line and the three items.
    - _Requirements: 7.1, 7.8, 7.9_

- [x] 5. SRS size derivation, vendoring, sha256 file and its test, and `verify-srs`
  - Measure the compiled circuit, derive the point count, vendor the matching ceremony prefix, pin its sha256 in a manifest, test it, and write the re-verification script.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.8, 14.9_

  - [x] 5.1 Measure the circuit size and choose the point count
    - Look up `circuitStats` in the published `bb.js` 6.0.0 types and source (L4, L5) and record the lookup. From the repository root, run a throwaway `node --input-type=module -e` script (no repo file is created) that creates `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })`, base64-decodes and gunzips the Artifact `bytecode` (with `node:zlib`), and calls `circuitStats` with `PROOF_SETTINGS` (`ipaAccumulation: false`, `oracleHashType: 'poseidon2'`, `disableZk: false`, `optimizedSolidityVerifier: false`) to read `numGates` and `numGatesDyadic`. Cross-check with `~/.bb/bb gates -b circuits/ledger_audit/target/ledger_audit.json -t noir-recursive` (U14; if the CLI rejects the file, record that and use only the `circuitStats` figure). Destroy the instance.
    - Compute `requiredPoints = max(numGatesDyadic, 512)` and the chosen point count `N` as the smallest power of two not smaller than `requiredPoints`. Do not assume 2^16: if `requiredPoints` exceeds 2^16, `N` is the smallest power of two that fits and is not 2^16.
    - Record in `.kiro/steering/noir.md` "Settled choices": `numGates`, `numGatesDyadic`, `requiredPoints`, `N`, the date and the commands used.
    - Done when: the five values are recorded in `noir.md`.
    - Recorded in: `.kiro/steering/noir.md` "Settled choices", Results_Document "Lookups".
    - _Requirements: 14.2, 14.3, 1.9, 1.10_

  - [x] 5.2 Take the SRS files and write the manifest
    - Create `src/zk/artifacts/srs/`. Download the g1 prefix with `curl --fail -sS -H "Range: bytes=0-<END>" -o src/zk/artifacts/srs/g1.dat https://crs.aztec-cdn.foundation/g1.dat` where `END = N * 64 - 1`, expecting HTTP 206 and a file of exactly `N * 64` bytes. Download `https://crs.aztec-cdn.foundation/g2.dat`, expecting 128 bytes with sha256 `01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f`. Request the same range from the mirror `https://crs.aztec-labs.com/g1.dat` and `g2.dat` and confirm the sha256 values match. Only the ceremony prefix is downloaded, never the full 6.4 GB file. No batch data is involved.
    - Write `src/zk/artifacts/srs/srs.sha256.json` with `format` `bn254-g1-uncompressed-be64`, `pointCount`, `bytesPerPoint` 64, and `files` entries for `g1.dat` and `g2.dat` (`bytes`, `sha256` as 64 lowercase hex from `shasum -a 256`, `source`, `mirror`, `byteRange` as `bytes=0-<END>` and `null`).
    - Record in `.kiro/steering/noir.md` for each file: the source URL, the byte range taken, and the sha256.
    - Done when: file sizes are `N * 64` and 128 bytes, the mirror hashes match, and the manifest values equal the `noir.md` values.
    - Recorded in: `src/zk/artifacts/srs/srs.sha256.json`, `.kiro/steering/noir.md` "Settled choices".
    - _Requirements: 14.1, 14.4, 14.5_

  - [x] 5.3 Write `src/zk/srs.ts` and `src/zk/srs-assets.ts`
    - `src/zk/srs.ts`: `SrsSource` (`readG1()`, `readG2()`), `SrsBytes` (`g1`, `g2`, `pointCount`), `SrsManifest` and `SrsFileEntry` types, `loadSrs(source, manifest)` (checks length and sha256 against the manifest through `crypto.subtle.digest`, throws a coded error `SRS_FETCH` or `SRS_HASH`), `initSrs(api, srs)` (calls `api.srsInitSrs({ pointsBuf, numPoints, g2Point })` with exactly `numPoints * bytesPerPoint` bytes). The loader reads `pointCount` and `bytesPerPoint` from the manifest; no point count is hard-coded.
    - `src/zk/srs-assets.ts`: `import g1Url from './artifacts/srs/g1.dat?no-inline'`, the same for `g2.dat`, and the manifest import; export `SRS_URLS` and `SRS_MANIFEST`. `g2.dat` is 128 bytes, so `?no-inline` is required so that a real file is emitted.
    - Lookup first, recorded in "Lookups": `srsInitSrs` request type and byte-size rule (L4, L5), Vite `?no-inline` and JSON import (L12).
    - Done when: `npm run typecheck` exits 0. If `tsc` does not accept the `?no-inline` imports through `vite/client` types, resolve it from the Vite docs lookup without weakening strict mode, and record the lookup.
    - _Requirements: 14.1, 14.7, 1.9, 1.10_

  - [x] 5.4 Write `tests/zk/srs.test.ts`
    - Example test, runs under `npm test`, calls no prover. Fails when: the manifest is missing, not valid JSON or lacks a key; a hash is not 64 lowercase hex; `pointCount * bytesPerPoint` differs from the `g1.dat` `bytes`; a data file is missing; a file's length or sha256 differs from the manifest; `g2.dat` is not 128 bytes with sha256 `01797bfc…c32f`; or either manifest sha256 is absent from the text of `.kiro/steering/noir.md`.
    - Add the size check: using `circuitStats` on the committed Artifact (a WASM `Barretenberg` with `skipSrsInit: true`, the bytecode decoded with `node:zlib`, `destroy()` in `afterAll`), assert `pointCount >= max(numGatesDyadic, 512)`.
    - Done when: `npx vitest run tests/zk/srs.test.ts` exits 0.
    - _Requirements: 14.2, 14.6, 14.8_

  - [x] 5.5 Write `scripts/verify-srs.ts`
    - Node 24 type-stripping script with erasable syntax only. It reads `src/zk/artifacts/srs/srs.sha256.json`; requests the same `bytes=0-<END>` range from `https://crs.aztec-labs.com/g1.dat` and `g2.dat` from the mirror and compares byte for byte and by sha256 with the committed files; then requests `ceil(N / 131072)` 4 MiB chunks of `g1_compressed.dat` from the primary host, calls `srsInitSrs` on a WASM `Barretenberg` with `skipSrsInit: true` so `bb.js` checks each chunk against its pinned hash, and compares the first `N * 64` returned bytes with the committed `g1.dat`. It prints `PASS` or `FAIL` per file with the byte counts and nothing else. It is a developer script that uses the network; the app never does.
    - Run it once with `node scripts/verify-srs.ts` (U15). If Node type stripping fails under the repo `tsconfig`, rename to `.mjs` with JSDoc and record the change. If the network is unavailable, record that and leave the run to huynh.
    - Done when: the script prints `PASS` for both files, or the failure reason is recorded.
    - Recorded in: Results_Document "Lookups" and "Browser steps for huynh" (task 9.8 repeats the command).
    - _Requirements: 14.4, 1.9, 1.10_

  - [x] 5.6 Commit the SRS files
    - Add a `.gitattributes` file with the single line `src/zk/artifacts/srs/*.dat binary`. Run `git add .gitattributes src/zk/artifacts/srs/g1.dat src/zk/artifacts/srs/g2.dat src/zk/artifacts/srs/srs.sha256.json` (by name) and commit with a message that states they are the ceremony prefix and its manifest.
    - Confirm `git ls-files src/zk/artifacts/srs` lists all three paths. Choose `N` only once: a re-commit with a different `N` adds a full copy to history.
    - Done when: the three SRS paths are tracked.
    - _Requirements: 14.1_

  - [x] 5.7 Commit group 5 files
    - Task 5.6 already committed `.gitattributes` and the SRS files (`g1.dat`, `g2.dat`, `srs.sha256.json`), so this commit covers the rest of the group. Run `git status --short`. Stage by name: `src/zk/srs.ts`, `src/zk/srs-assets.ts`, `tests/zk/srs.test.ts`, `scripts/verify-srs.ts` (or `scripts/verify-srs.mjs` if task 5.5 renamed it), `.kiro/steering/noir.md`, `docs/spike-results.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`, plus `tsconfig.json` or a Vite client types declaration file only if task 5.3 changed one. Do not stage the SRS files or `.gitattributes` here. Commit with the message `feat(zk): vendored SRS prefix, size derivation, sha256 test and verify-srs`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit).
    - _Requirements: 14.1, 14.2, 14.8_

- [x] 6. Witness_Builder, hashing wrapper, encoder, and the default-run tests that gate correctness
  - Build the TypeScript hashing, Merkle, validation and input-map modules with their test support, then the default-run properties and example tests, then measure the default run.
  - _Requirements: 2.4, 2.5, 2.9, 3.1, 3.2, 3.4, 3.7, 3.8, 3.9, 3.10, 3.11, 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 7.2, 7.4, 7.5_

  - [x] 6.0 Close the absolute-path gap in the Build_Script and record its known limits
    - Amend `scripts/build-circuit`: after the textual rewrite and the existing checks, parse the rewritten text only as a check (the output is still produced by textual replacement) and fail with step `path rewrite` (exit 1, `src/zk/artifacts/` untouched, no tmp files) if any `file_map[*].path` starts with `/`, `~` or matches `^[A-Za-z]:[\\/]`. Lookup first (record in "Lookups", ids `T6.0-a`, ...) anything new used. Failure tests in a scratch copy OUTSIDE the repo with a `nargo` shim (as in task 4.1): an absolute path outside the repo and home (`/Users/someone/else/file.nr`), a `~/x.nr` path, a `C:\\x\\y.nr` path, each exits 1 with `step path rewrite failed` and leaves the artifact dir untouched.
    - Re-run `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit` in the repo and confirm the Artifact and Meta are byte-identical to the committed ones (sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b` and `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`): the check must not change the output; `git status` shows no change under `src/zk/artifacts/`.
    - Extend `tests/zk/artifact.test.ts` (`validateFileMapPaths`) with the matching cases: absolute `/`, `~`, drive letter `C:\` and `D:/`, and the JSON-escaped form; add mutated cases for `~` and for a path like `/Users/someone/else/file.nr` that the older checks did not cover. The committed Artifact must still pass. `npx vitest run tests/zk/artifact.test.ts` exits 0.
    - Record the Build_Script known limits in `docs/spike-results.md` under a NEW section `## Build_Script` placed after "Tests written first" and before "Lookups" (append the section; do not change other sections), with a subsection "Known limits (accepted by huynh)" listing, each as one bullet: (1) a `.tmp-<pid>` file left by a killed run (SIGKILL, power loss) is never cleaned up, because the suffix is the pid; (2) a kill between the two renames leaves the new Artifact with the old Meta, and only the checksum test (7.8) notices; (3) the restore path after a failed second rename has no test; (4) `target/ledger_audit.json` is not deleted before `nargo compile`, so a stale file would be read as fresh if nargo exited 0 without writing a new one (case "artifact missing" only triggers on a clean checkout); (5) an unexpected non-step error is labelled with whatever step was running (for example EACCES at the read step), and a missing `nargo` is reported as step `version`; (6) the Windows path forms (`\\`-escaped and forward-slash) are implemented but were not run on Windows. Add a note that two further limits found in tasks 4.1 and 4.4 (an absolute path outside the repo and home directory accepted, and an unknown symlink form slipping through) are CLOSED by this task's generic absolute-path check.
    - Done when: `node --check scripts/build-circuit` passes, the scratch failure tests exit 1 as described, the committed Artifact and Meta are unchanged by a re-run, `npx vitest run tests/zk/artifact.test.ts` exits 0, `npm test` and `npm run typecheck` exit 0, and the `## Build_Script` section is present with the six limits.
    - Recorded in: Results_Document "Build_Script" and "Lookups".
    - _Requirements: 7.2, 7.4, 7.5, 1.9, 1.10_

  - [x] 6.1 Write `field.ts`, `posting.ts` and `errors.ts`
    - Create under `src/zk/`: `field.ts` (`FIELD_MODULUS`, `CAPACITY` 64, `AMOUNT_BOUND_CENTS` 2^40 exclusive, `ID_MAX` 2^64 - 1, `SALT_BOUND` 2^248 exclusive, `fieldToBytes32`, `bytes32ToField`); `posting.ts` (`Cents`, `Side`, `ReviewFlag`, `Posting`, `PADDING_POSTING`, `SIDE_DEBIT`, `SIDE_CREDIT`, `FLAG_NO`, `FLAG_YES`, `leafInputs(p)` returning the six bigints in leaf order); `errors.ts` (`PostingFieldName`, `FieldRangeError` with `field` and `slot`, message `<LABEL> OUT OF RANGE AT SLOT <n>` or `<LABEL> OUT OF RANGE`, never the value, not extending `RangeError`, no property holding the value).
    - Amounts are `bigint`; no `Number` touches an amount. Strict TypeScript; no `any`.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 3.4, 3.9, 3.10, 4.2_

  - [x] 6.2 Write `hash.ts` and `merkle.ts`
    - `src/zk/hash.ts`: `Poseidon2Api`, `Hasher`, `createHasher(api)`. Every leaf and every inner node is computed by calling `api.poseidon2Hash({ inputs })` with 32-byte big-endian elements. No Poseidon constants, permutation code or field arithmetic that computes a hash.
    - `src/zk/merkle.ts`: `merkleRoot(hasher, leaves)` requiring 64 leaves and pairing in the circuit's order (parent `j` is `hash(level[2j], level[2j + 1])`, six levels).
    - Lookup first, recorded in "Lookups": `poseidon2Hash` request and response types in `bb.js` 6.0.0 (L4).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 3.1, 3.2, 3.7, 1.9, 1.10_

  - [x] 6.3 Write the test support files
    - Create `tests/support/pbt.ts` (prints the seed and `numRuns` to stdout at the start of every property run; fast-check failure output carries the shrunk counterexample) and `tests/support/zk-env.ts` with `createNoirEnv()` (loads `src/zk/artifacts/ledger_audit.json` from disk, creates `Noir`), `createHasherEnv()` (WASM single-thread `Barretenberg` with `skipSrsInit: true`, no `srsInitSrs`) and `createProverEnv()` (also initialises the SRS from the files on disk through `src/zk/srs.ts`). Every file that creates a `Barretenberg` calls `destroy()` in `afterAll`. No test makes a network request.
    - Check U19 on first use: `poseidon2Hash` works with no `srsInitSrs`. If it does not, `createHasherEnv()` loads the committed SRS prefix (no proving is added).
    - Lookup first, recorded in "Lookups": `Barretenberg.new` options and `destroy` in `bb.js` 6.0.0 (L1, L2), `Noir` constructor and `execute` in `noir_js` 1.0.0 (L6).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 6.1, 6.7, 1.9, 1.10_

  - [x] 6.4 Write `tests/zk/hash-kat.test.ts` (Property 6)
    - **Property 6: Recorded hash vectors are reproduced**
    - Table-driven example test, no seed or `numRuns` (the table is the quantifier). For `PAD_LEAF`, `LEAF_A`, `LEAF_B`, `NODE_A`, `NODE_SMALL` and `EMPTY_ROOT` assert the `bb.js` hasher returns exactly the recorded field element, and that each output equals a reference sponge built only from `poseidon2Permutation` for the two call shapes (length 2 and length 6). Copy the expected values into the test and compare them with the values in `.kiro/steering/noir.md`, as `srs.test.ts` does for its hashes.
    - If the TypeScript output differs from the circuit vectors (U3), STOP and report per Requirement 3.3: variants tried, input vectors, output of each side, package versions. Adopt no other hash until huynh approves it.
    - Done when: `npx vitest run tests/zk/hash-kat.test.ts` exits 0.
    - **Validates: Requirements 3.11, 3.2**
    - _Requirements: 3.2, 3.3, 3.11_

  - [x] 6.5 Write `circuit-inputs.ts` and `witness-builder.ts`
    - `src/zk/circuit-inputs.ts`: `CircuitPosting`, `CircuitInputs` (`merkle_root`, `record_count`, `limit_cents` and 64 `postings` entries, every integer as a decimal string) and `toCircuitInputs(...)`.
    - `src/zk/witness-builder.ts`: `WitnessInput`, `BuiltInputs`, `validatePosting(p, slot)`, `validateScalars`, `buildCircuitInputs(hasher, input)` (validates, pads to 64 with `PADDING_POSTING`, hashes, builds the map) and `assembleCircuitInputs(hasher, slots, recordCount, limitCents, rootOverride?)`. Order: validate `recordCount` and `limitCents`, then every slot (`recordId` and `account` at most 2^64 - 1, `side` and `reviewFlag` in {0, 1}, `amountCents` below 2^40, `salt` below 2^248) throwing `FieldRangeError` on the first violation in slot order, and only then hash. No hash call and no `noir_js` call happens for an invalid value. Validators compare bigints and never stringify a value for an error.
    - Lookup first, recorded in "Lookups": `InputValue` and `abiEncode` input rules in `noirc_abi` 1.0.0 and `@noir-lang/types` (L7, L8).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 2.4, 2.5, 3.4, 3.7, 3.9, 3.10, 1.9, 1.10_

  - [x] 6.6 Write `tests/zk/witness-builder.test.ts`
    - Example test, runs under `npm test`. Spy hasher: every leaf and node goes through `poseidon2Hash` (64 leaves and 63 nodes) and the builder holds no hash computation (3.7). Padding slots are the single `PADDING_POSTING` (3.9). Out-of-range `recordId`, `account`, `salt`, `side`, `reviewFlag`, `limitCents` and `recordCount` each throw `FieldRangeError` with the right `field` and `slot`, build no inputs, call the hasher zero times, and the error message and own properties contain no field value (3.10).
    - Done when: `npx vitest run tests/zk/witness-builder.test.ts` exits 0.
    - _Requirements: 3.7, 3.9, 3.10_

  - [x] 6.7 Write `tests/zk/circuit-inputs.test.ts` and run the Node `execute` experiment
    - Example test, runs under `npm test`. Check the ABI shape of the Artifact: exactly three public inputs `merkle_root`, `record_count`, `limit_cents`, a private `postings` array of 64, no return value (2.4, 2.5). Check that a missing public input and 63 or 65 postings make `abiEncode` throw (2.9).
    - Add the Q5 experiment: execute the circuit in Node with the one-cent-modified witness (slot 0 amount plus 1 cent, leaves and root recomputed) and assert it throws. Print the error constructor name, the own property names and whether the message contains a private value, and record the observed shape under "Invalid-witness report" in `docs/spike-results.md` as a Node pre-check, labelled as Node and not as the browser result. Add one bullet to the "API as looked up" section of `.kiro/steering/noir.md` stating the Node-observed behaviour; leave the existing "Unverified" bullet in place and mark the browser observation as pending huynh's run (Requirement 9.5 completes after the browser report).
    - If the observed behaviour differs from the behaviour `noir.md` assumed, append a quirks log entry to `noir.md` with the date in `YYYY-MM-DD` form, the assumed behaviour, the observed behaviour, and the `noir_js` and `bb.js` versions.
    - Done when: `npx vitest run tests/zk/circuit-inputs.test.ts` exits 0 and the Node-observed shape is recorded.
    - Recorded in: Results_Document "Invalid-witness report" (Node pre-check), `.kiro/steering/noir.md`.
    - _Requirements: 2.4, 2.5, 2.9, 9.5, 9.6_

  - [x] 6.8 Write `tests/support/zk-arbitraries.ts`
    - fast-check arbitraries including `validWitnessArb`: `recordCount` in 1..64, a limit, real postings that balance by construction (all but the last drawn at random with amounts below 2^34, the last takes the net difference on the opposite side, amount 0 when there is only one posting), `reviewFlag` forced to 1 whenever an amount exceeds the limit, every other slot `PADDING_POSTING`. Values are synthetic.
    - Done when: `npm run typecheck` exits 0 and the arbitrary is used by tasks 6.9 to 6.11.
    - _Requirements: 6.1, 6.2_

  - [x] 6.9 Write `tests/zk/root-parity.prop.test.ts` (Property 1)
    - **Property 1: Witness_Builder root is accepted by the circuit**
    - Tag comment `Feature: zk-spike, Property 1: Witness_Builder root is accepted by the circuit`. Seed `20261101`, `numRuns` 100. For every valid witness from `validWitnessArb`, build the inputs with the Witness_Builder and `noir.execute` returns a witness without throwing. The inputs MUST come from the real Witness_Builder (its own leaf hashing, leaf field order and Merkle root, never hand-built field arrays or constants copied from the Noir tests), and `noir.execute` MUST run on the committed Artifact `src/zk/artifacts/ledger_audit.json` (loaded through `createNoirEnv()`, task 6.3), so that a leaf field order mismatch between TypeScript and `leaf_fields` in the circuit makes the property fail (huynh's soundness review note; the order is not pinned by any `nargo` test). Execution only, no proving. Per-test timeout (third argument of `it`) `max(60 s, 5 x numRuns x (T_build + T_exec))`, start at 120 s and adjust after the first measured run.
    - Done when: `npx vitest run tests/zk/root-parity.prop.test.ts` exits 0 and prints the seed.
    - **Validates: Requirements 3.8, 6.2**
    - _Requirements: 3.8, 6.2, 6.7_

  - [x] 6.10 Write `tests/zk/one-cent-change.prop.test.ts` (Property 2)
    - **Property 2: Changing one amount by one cent is rejected**
    - Tag comment `Feature: zk-spike, Property 2: Changing one amount by one cent is rejected`. Seed `20261102`, `numRuns` 100. Draw the witness first, then one slot (0 to 63, padding slots included) and one direction (+1 or -1 cent) from the set of pairs whose new amount stays within 0 to 2^40 - 1 (never empty, no run skipped). Execute with the one changed amount and the original `merkle_root`; it must throw. Same timeout rule as Property 1.
    - Done when: `npx vitest run tests/zk/one-cent-change.prop.test.ts` exits 0 and prints the seed.
    - **Validates: Requirements 6.3**
    - _Requirements: 6.3, 4.1, 4.3, 4.5, 4.10, 6.7_

  - [x] 6.11 Write `tests/zk/amount-range.prop.test.ts` (Property 3)
    - **Property 3: Out-of-range amounts are rejected before any input is built**
    - Tag comment `Feature: zk-spike, Property 3: Out-of-range amounts are rejected before any input is built`. Seed `20261103`, 300 runs in total: one test with three `fc.assert` calls of 100 runs each, for amounts from 2^40 to 2^64 - 1, from 2^53 - 2 to 2^53 + 2, and from the field modulus minus 2 to the field modulus plus 2. For each, building the inputs throws `FieldRangeError` with `field` `amountCents` and `slot` equal to the drawn index; a spy hasher reads zero calls; the message contains neither the decimal nor the `0x` hexadecimal form of the amount. Timeout 30 s.
    - Done when: `npx vitest run tests/zk/amount-range.prop.test.ts` exits 0 and prints the seed.
    - **Validates: Requirements 6.4, 3.10**
    - _Requirements: 6.4, 3.10, 6.7_

  - [x] 6.12 Run the default tests and record the measurement
    - Run `npx vitest run --reporter=verbose` once. Record in `docs/spike-results.md` (under "Lookups", subsection "Default-run measurement") the duration of each of the three property files and the wall-clock of `npm test`. Settle U16 and U19. Record `T_build` and `T_exec` and adjust the Property 1 and 2 timeouts by the formula in task 6.9. No batch data is printed.
    - If `npm test` exceeds 60 s wall-clock, or Property 1 or Property 2 exceeds 40 s, first remove per-run overhead (one shared `Noir` and one shared hasher per file). `numRuns` is not lowered. If `execute` itself is the cost, STOP and ask huynh, because moving Property 1 or 2 to `test:proof` changes where the parity gate runs.
    - If any property finds a real bug, add a regression example test and append an entry to `tests/PBT-LOG.md`.
    - Done when: `npm test` and `npm run typecheck` exit 0 and the measurement is recorded.
    - Recorded in: Results_Document "Lookups" (Default-run measurement).
    - _Requirements: 3.8, 6.2, 6.3, 6.4, 6.8_

  - [x] 6.13 Commit group 6 files
    - Run `git status --short`. Stage by name: `src/zk/field.ts`, `src/zk/posting.ts`, `src/zk/errors.ts`, `src/zk/hash.ts`, `src/zk/merkle.ts`, `src/zk/circuit-inputs.ts`, `src/zk/witness-builder.ts`, `tests/support/pbt.ts`, `tests/support/zk-env.ts`, `tests/support/zk-arbitraries.ts`, `tests/zk/hash-kat.test.ts`, `tests/zk/witness-builder.test.ts`, `tests/zk/circuit-inputs.test.ts`, `tests/zk/root-parity.prop.test.ts`, `tests/zk/one-cent-change.prop.test.ts`, `tests/zk/amount-range.prop.test.ts`, `scripts/build-circuit`, `tests/zk/artifact.test.ts`, `docs/spike-results.md`, `.kiro/steering/noir.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`, plus `package.json` only if task 6.0 changed it. If task 6.12 added a regression example test or a `tests/PBT-LOG.md` entry, stage those files by name too. Commit with the message `feat(zk): witness builder, hashing wrapper and default-run property tests`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit).
    - _Requirements: 3.8, 6.2, 6.3, 6.4, 7.2, 7.4_

- [ ] 7. Spike worker and page, plus the proof smoke test and the proof test split
  - Add the prover wrappers, the synthetic witness, the proof run configuration and the one-proof smoke test, then the worker, the view model and the page.
  - _Requirements: 6.1, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.16, 9.1, 9.2, 9.3, 9.4, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 14.2, 14.7, 14.8_

  - [x] 7.1 Write `src/zk/gzip.ts`
    - `gunzip(bytes)` using `DecompressionStream('gzip')` and `base64ToBytes(s)`. Needed because `circuitProve` takes the uncompressed ACIR and witness.
    - Lookup first, recorded in "Lookups": `DecompressionStream` availability in Node 24 and browsers.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.2, 1.9, 1.10_

  - [x] 7.2 Write `src/zk/prover.ts`
    - Exports `PROOF_SETTINGS` (`ipaAccumulation: false`, `oracleHashType: 'poseidon2'`, `disableZk: false`, `optimizedSolidityVerifier: false`), `createBb(srs)` (`Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })` then `api.srsInitSrs(...)`), `acirBytes(artifact)`, `executeCircuit(noir, inputs)`, `proveCircuit(api, acir, witness)` (`circuitProve` with an empty verification key and the gunzipped witness; returns proof, public inputs and the computed key), `verifyProofWithVk(api, vk, publicInputs, proof)` (`circuitVerify`) and `circuitSizes(api, acir)`. Proof size is `32 * proof.length` bytes. No UI code. Every `Barretenberg.new(` call passes `skipSrsInit: true`.
    - Lookup first, recorded in "Lookups": `circuitProve`, `circuitVerify`, `circuitStats` request and response types, and `BackendType.Wasm` (L1, L4, L5).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.2, 8.12, 14.7, 1.9, 1.10_

  - [x] 7.3 Write `src/zk/artifact.ts`
    - `ARTIFACT_URL` through `import artifactUrl from './artifacts/ledger_audit.json?url&no-inline'` and `loadArtifactFromUrl(url)` that fetches (same origin, GET, no body) and parses. Check U9: that `?url&no-inline` combine; if not, use the alternative the Vite docs lookup supports and record it.
    - Lookup first, recorded in "Lookups": Vite `?url` and `?no-inline` handling (L12).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.11, 10.2, 1.9, 1.10_

  - [x] 7.4 Write `src/zk/spike-witness.ts` and `tests/zk/spike-witness.test.ts`
    - `spike-witness.ts`: first line a comment containing `SYNTHETIC DEMO DATA`. 64 postings from a fixed formula (no randomness): `recordId = 100000001 + i`, `account = 900000000000 + 7919 * i` (12 digits), `salt = 5000000000 + 104729 * i`; 32 pairs with slot `2k` debit and `2k + 1` credit of the same amount `150000 + 12345 * k`, except pairs with `k % 8 == 7` use `1250000 + k` with `reviewFlag` 1 on both slots; `limitCents` 1000000; `recordCount` 64; the Merkle root is not committed. The constant is frozen.
    - `tests/zk/spike-witness.test.ts` (runs under `npm test`): executes in Node through `noir.execute` without error (8.3); the first line contains `SYNTHETIC DEMO DATA` (8.4); every `recordId`, `account`, `amountCents` and `salt` is at least 100000; every account has exactly 12 digits so it cannot be a PAN; every amount is below 2^40; slot 0 amount plus 1 cent is still at most the limit; the file contains no key material (10.6).
    - Done when: `npx vitest run tests/zk/spike-witness.test.ts` exits 0.
    - _Requirements: 8.3, 8.4, 9.1, 10.6_

  - [x] 7.5 Exclude `tests/zk/proof/**` from the default run
    - In `vite.config.ts` add `exclude: [...configDefaults.exclude, 'tests/zk/proof/**']` to the `test` block, importing `configDefaults` from `vitest/config`. Do not change anything else in the file in this task.
    - Look up the Vitest 5.1.1 `exclude` behaviour first and record it in "Lookups" (L16).
    - The directory `tests/zk/proof/` gets its first file in task 7.7, where `npx vitest list` is run to confirm it prints no file under `tests/zk/proof/`.
    - Done when: the `exclude` line is present and `npx vitest run` still passes.
    - _Requirements: 6.1, 1.9, 1.10_

  - [x] 7.6 Write `vitest.proof.config.ts` and the `test:proof` script
    - Create `vitest.proof.config.ts` at the repository root: `environment: 'node'`, `include: ['tests/zk/proof/**/*.test.ts']`, `exclude: [...configDefaults.exclude]`, `testTimeout` and `hookTimeout` equal to a named constant `PROOF_TEST_TIMEOUT_MS` (placeholder `900_000` until task 7.7 measures), `fileParallelism: false`. Add `"test:proof": "vitest run --config vitest.proof.config.ts"` to `package.json` (`test` stays exactly `vitest run`). Add `vitest.proof.config.ts` to `tsconfig.json` `include`.
    - Check that `fileParallelism: false` is accepted in a `defineConfig` `test` block in Vitest 5.1.1; record the result.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 6.1, 6.5_

  - [x] 7.7 Write `tests/zk/proof/proof-smoke.test.ts` and run the first proof
    - Example test, run only by `npm run test:proof`. Uses `createProverEnv()` and the Spike_Witness: builds inputs, executes, proves with `threads: 1` and the committed SRS, verifies with the key returned by the prove, asserts verification is true, asserts the decoded public inputs equal `[merkle_root, record_count, limit_cents]` in that order (U11), prints `T_prove` and `T_verify` in milliseconds and nothing else. Add the minimality probe: the same prove with the first `N / 2` points, expected to throw an error whose message contains `too many points` (U10).
    - Run `npm run test:proof`.
    - If the prove fails with a Grumpkin-SRS error (U7, D2), STOP and ask huynh: vendoring a 4 MiB Grumpkin file (`grumpkin_g1_v2.dat`) is a second binary file and a user decision.
    - If the prove fails with `prover trying to get too many points ... <have> vs <need>`, the chosen `N` is too small: return to tasks 5.1, 5.2, 5.4 and 5.6 with `nextPow2(need)`, rerun, and note that the earlier files remain in git history.
    - Replace `PROOF_TEST_TIMEOUT_MS` with `max` of the Property 4 value `3 x 3 x (T_prove + T_verify)` and the Property 5 value `3 x 3 x (T_prove + 4 x T_verify)`, each rounded up to the next 10 s. Record `T_prove`, `T_verify`, `numGates`, the confirmed `N` and the minimality-probe result in the Results_Document "Lookups" section (subsection "Node proof timing") and settle U6, U7, U10, U11 and U13 there.
    - Done when: `npm run test:proof` exits 0 and `npx vitest list` shows no file under `tests/zk/proof/`.
    - _Requirements: 14.2, 14.8, 8.3, 8.12, 6.5_

  - [x] 7.8 Update `noir.md` with the API path and the single-thread evidence
    - In `.kiro/steering/noir.md` "API as looked up", replace the `UltraHonkBackend` snippet for this project with the low-level `circuitProve` and `circuitVerify` path from `prover.ts` and state why (verification stays separate from proving; the proof size convention `32 * proof.length`). In "Settled choices", record the settings that made the Node single-thread proof work (`backend: BackendType.Wasm`, `threads: 1`, `skipSrsInit: true`, `srsInitSrs` with the vendored prefix, worker `format: 'es'` when set) and state that the browser answer on `crossOriginIsolated` false is pending huynh's step 4 in "Browser steps for huynh".
    - Done when: the three edits are present in `noir.md` and no other section changed.
    - Recorded in: `.kiro/steering/noir.md`.
    - _Requirements: 3.6, 1.9_

  - [x] 7.9 Write `tests/zk/proof-isolation.test.ts`
    - Example test, runs under `npm test`. Fails when: (1) a file under `tests/` outside `tests/zk/proof/` contains `circuitProve`, `circuitVerify` or `UltraHonkBackend`, or contains `createProverEnv` (a call, an import or any other mention) unless the file is `tests/support/zk-env.ts` (which defines it per task 6.3 and may mention it in comments); the isolation test file itself is excluded from this scan, because it contains these strings as the patterns it searches for. The `createProverEnv` exception exists because the definition lives in `tests/support/zk-env.ts` per task 6.3 (found when task 6.3 ran); (2) a file under `tests/zk/proof/` does not end in `.test.ts`, or a file there that imports `fast-check` does not end in `.prop.test.ts`; (3) `vite.config.ts` does not contain the string `tests/zk/proof/**`; (4) `package.json` has no `test:proof` script, the `test` script is not exactly `vitest run`, or `test:proof` does not contain `--config vitest.proof.config.ts`; (5) `vitest.proof.config.ts` is missing.
    - Done when: `npx vitest run tests/zk/proof-isolation.test.ts` exits 0.
    - _Requirements: 6.1_

  - [x] 7.10 Write `tests/zk/srs-wiring.test.ts`
    - Example test, runs under `npm test`. Reads every file under `src/zk/` and fails when a `Barretenberg.new(` call does not pass `skipSrsInit: true`. Also fails when a file under `src/zk/` contains the strings `crs.aztec-cdn.foundation` or `crs.aztec-labs.com`.
    - Done when: `npx vitest run tests/zk/srs-wiring.test.ts` exits 0.
    - _Requirements: 14.7_

  - [x] 7.11 Write `src/zk/spike-protocol.ts`
    - Types `Stage` (`WASM INIT`, `WITNESS PREP`, `EXECUTE`, `PROVE`, `VERIFY`), `FailReason`, `PageToWorker` (`run`, `run-invalid`) and `WorkerToPage` (`stage-start`, `stage-end` with floored milliseconds, `init-detail`, `done` with `proofBytes` and `workerIsolated`, `failed` with stage, reason, `have`, `need`, `field`, `slot`, `invalid-report`). No message carries a posting, leaf, root, limit, salt or error message string, except `invalid-report`.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.2, 8.9, 9.2, 10.1_

  - [x] 7.12 Write `src/zk/spike-report.ts`
    - `describeError` (`typeofThrown`, `ctorName` or null, `ownPropertyNames` through `Object.getOwnPropertyNames` or null, `message` or null), `containsWholeToken` (case-insensitive, delimiters are any character other than a letter or digit), `findLeakedFields(texts, postings)` (decimal and `0x` lowercase hexadecimal forms of `amount`, `salt`, `account`, `record_id` of every posting; texts are the message, every own string value, strings inside own arrays and `JSON.stringify` of other plain-object own properties) and `modifyFirstSlotByOneCent(spikeWitness)` (returns a copy with slot 0 amount plus 1; never mutates the original). Nothing writes to `console.*`.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 9.1, 9.2, 9.4, 9.7_

  - [x] 7.13 Write `src/zk/spike-view.ts`
    - The copy table (uppercase, one table is the only source of visible strings: `FAIL_FETCH`, `FAIL_SRS_HASH`, `FAIL_SRS_REJECTED`, `FAIL_FIELD_RANGE`, `FAIL_CONSTRAINT`, `FAIL_SRS_TOO_SMALL`, `FAIL_PROOF_REJECTED`, `TIMEOUT`, plus the other labels) and the pure reducer `reduce(state, event)` with states `idle`, `running`, `succeeded`, `failed`, `timedOut`. Behaviour: controls disabled while running; a second `run` event ignored; completed stage rows kept on failure; `TOTAL` and proof size absent on failure; the success view never contains `FAILED`; status and error text at most 10 words, uppercase, naming the stage or invariant; `FAILED <STAGE>: <REASON>` template; the permanent `DEMO DATA` label; the invalid-witness labels from the design.
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.5, 8.9, 8.10, 8.13, 8.14, 8.15, 8.16, 9.2, 9.8_

  - [x] 7.14 Write `src/zk/spike-worker.ts`
    - Module worker (no `window`). Stages run strictly in sequence in one `async` function: WASM INIT (fetch artifact, `g1.dat`, `g2.dat` from the same origin; initialise `acvm_js` and `noirc_abi` WASM with the `?url` imports through `init({ module_or_path: url })`; `createBb`; verify SRS sha256 against the manifest; `srsInitSrs`; gunzip the ACIR; send `init-detail` messages that are not part of the stage sum), WITNESS PREP (`buildCircuitInputs` on the Spike_Witness), EXECUTE, PROVE (`threads: 1`), VERIFY (key from PROVE). Stage times are floored `performance.now()` differences. The failure classifier maps errors to a `FailReason` and sends no raw message; an error containing `too many points` becomes `SRS_TOO_SMALL` with `have` and `need`. Send `workerIsolated` from `crossOriginIsolated`. On `run-invalid`: use `modifyFirstSlotByOneCent`, rebuild leaves and root, call `noir.execute` exactly once in `try/catch`, build the `InvalidReport`, and if a witness was returned load the SRS, attempt one proof and verify any proof returned. Only the stage names and millisecond values may reach `console.*`, and nothing is stored in web storage, IndexedDB, cookies or the Cache API. No `fetch` carries a body or a data-derived URL.
    - Lookup first, recorded in "Lookups": Vite worker constructor and `?url` imports (L12), `acvm_js` and `noirc_abi` `init` signature (L7), `bb.js` browser build behaviour (L1).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 8.1, 8.2, 8.8, 8.11, 8.12, 9.1, 9.2, 9.3, 9.4, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 14.7, 14.8, 1.9, 1.10_

  - [x] 7.15 Write `src/zk/spike.ts` and `spike.html`
    - `spike.html` at the repository root: static shell with `CRYPTTERM ZK SPIKE`, the permanent `DEMO DATA` label, the `RUN` and `INVALID WITNESS` controls, result areas; loads `/src/zk/spike.ts`. The string `SYNTHETIC DEMO DATA` does not appear in it.
    - `src/zk/spike.ts`: plain DOM. Takes `t0 = performance.now()` immediately before `new Worker(new URL('./spike-worker.ts', import.meta.url), { type: 'module' })`; updates the status line synchronously on each `stage-start` (within 250 ms); computes `TOTAL = Math.ceil(performance.now() - t0)` when `done` arrives; shows the five timings, `TOTAL`, `PROOF SIZE (BYTES)`, and `CROSS ORIGIN ISOLATED (PAGE)` and `(WORKER)` as `TRUE` or `FALSE`; disables both controls from worker creation until it finishes, fails or times out; maps worker `error` and `messageerror` to a failure of the running stage; shows the invalid-witness values as text (raw message in a `<pre>` with CSS `text-transform: uppercase`); starts a 120 s timer for `run-invalid` that terminates the worker and shows `FAILED INVALID WITNESS RUN: TIMEOUT` with controls usable again. No `console.*` of data, no web storage, no network call other than the worker's same-origin loads.
    - Done when: `npm run typecheck` and `npm test` exit 0.
    - _Requirements: 8.1, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.13, 8.14, 8.15, 8.16, 9.2, 9.7, 9.8, 10.1, 10.3, 10.4_

  - [-] 7.16 Commit group 7 files
    - Run `git status --short`. Stage by name: `src/zk/gzip.ts`, `src/zk/prover.ts`, `src/zk/artifact.ts`, `src/zk/spike-witness.ts`, `src/zk/spike-protocol.ts`, `src/zk/spike-report.ts`, `src/zk/spike-view.ts`, `src/zk/spike-worker.ts`, `src/zk/spike-classify.ts`, `src/zk/spike.ts`, `spike.html`, `tests/zk/spike-witness.test.ts`, `tests/zk/proof-isolation.test.ts`, `tests/zk/srs-wiring.test.ts`, `tests/zk/proof/proof-smoke.test.ts`, `vite.config.ts`, `vitest.proof.config.ts`, `package.json`, `tsconfig.json`, `docs/spike-results.md`, `.kiro/steering/noir.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`. Commit with the message `feat(zk): spike worker and page, proof smoke test and test:proof split`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit). No commit is made if `npm run test:proof` or `npm test` failed in this group.
    - _Requirements: 6.5, 8.1, 8.2_

- [ ] 8. Spike build mode, dist check script and the spike `_redirects` decision (D4)
  - Select the spike build with `vite build --mode spike`, keep the default build free of spike files, and add the dist allow-list check.
  - _Requirements: 7.7, 11.1, 11.2, 11.4, 12.4, 12.5, 12.6_

  - [ ] 8.1 Add the spike mode to `vite.config.ts`
    - Change the config to `defineConfig(({ mode }) => ...)` with `const spike = mode === 'spike'`. In spike mode: `plugins` holds only an inline `spikeRedirects()` plugin that emits `_redirects` containing `/  /spike.html  200`; `publicDir: false` (so `public/_redirects` and `public/samples/` are not copied); `build.rolldownOptions.input` is `'spike.html'`. In default mode: the React plugin, `publicDir: 'public'`, no `input` override. Both modes: `worker: { format: 'es' }` and `build.target: 'esnext'`. Keep the `test` block from task 7.5. Do not edit `public/_redirects` and do not create `public/_headers`.
    - Lookup first, recorded in "Lookups": `build.rolldownOptions.input`, `worker.format`, `publicDir`, plugin `generateBundle` or emit-file API in Vite 8 (L12).
    - Done when: `npm run typecheck` exits 0.
    - _Requirements: 11.2, 11.4, 12.4, 12.6, 1.9, 1.10_

  - [ ] 8.2 Write `scripts/check-spike-dist`
    - Node ESM script, no extension. Lists `dist/` recursively and exits 1, printing the offending paths, on any file outside this allow-list: `spike.html`, `_redirects`, and under `assets/` files ending `.js`, `.wasm`, `.dat`, `.json`, `.css`. It also fails on any other `.html` (including `index.html`), on `_headers`, on any `*.map`, and when a required file is missing: `spike.html`, a worker script, one `ledger_audit*.json`, two `.dat` files, the `acvm_js` and `noirc_abi` WASM files. It prints the sizes of the largest files.
    - The allow-list must accept the `.js` chunk names that the spike build references: `main.worker-*.js` and `thread.worker-*.js` (bb.js worker chunks), `barretenberg-*.js` and `barretenberg-threads-*.js` (bb.js chunks), `spike-*.js` (page chunk) and `spike-worker-*.js` (worker chunk), besides `acvm_js_bg-*.wasm`, `noirc_abi_wasm_bg-*.wasm`, `g1-*.dat`, `g2-*.dat` and `ledger_audit-*.json`. The build output measured in task 7.15 was 12 files and about 16.4 MiB (17,145,966 bytes), with no `index.html`.
    - Done when: `node --check scripts/check-spike-dist` reports no syntax error.
    - _Requirements: 11.2, 12.5, 12.6_

  - [ ] 8.3 Add the `build:spike` and `check:spike-dist` scripts
    - Add `"build:spike": "tsc --noEmit && vite build --mode spike"` and `"check:spike-dist": "node scripts/check-spike-dist"` to `package.json`. Leave `build` and `test` unchanged.
    - Done when: both scripts appear in `package.json` and `npm run typecheck` exits 0.
    - _Requirements: 11.2, 12.4_

  - [ ] 8.4 Build the default app and inspect `dist/`
    - Run `npm run build`. Then inspect `dist/`: `find dist -iname '*spike*'` prints nothing and the search tool finds no file containing `SYNTHETIC DEMO DATA`. Confirm `build.target` is `'esnext'` in `vite.config.ts` by reading it.
    - Done when: `npm run build` exits 0 and both inspections are clean. Record the result in the Results_Document "Spike-only files" section.
    - Recorded in: Results_Document "Spike-only files".
    - _Requirements: 11.1, 11.4_

  - [ ] 8.5 Build the spike without `nargo` on `PATH` and run the dist check
    - Build `PATH` from the directory of `node` plus `/usr/bin:/bin` so that `command -v nargo` prints nothing, then run `npm run build:spike` and `npm run check:spike-dist` under that `PATH`.
    - Inspect `dist/`: it contains `spike.html` and no `index.html`; `_redirects` reads `/  /spike.html  200`; no `_headers`; the worker chunk contains no Node-only imports (search for `node:` and `from "fs"`; if present, add `resolve.conditions: ['browser', 'module', 'import']` in spike mode, U8); two `.dat` files exist under `dist/assets/` and an `ledger_audit*.json` and the two `.wasm` files; the `bb.js` chunks may contain the ceremony host strings in their code, which are never reached with `skipSrsInit: true`, and `tests/zk/srs-wiring.test.ts` guards that option. If `?no-inline` did not emit real files or `publicDir: false` plus the emitted `_redirects` failed (U9), use `assetsInlineLimit: 0` in spike mode or a build plugin that copies the files.
    - Check `netlify.toml` has no `Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy` and is unchanged (`git diff --stat netlify.toml`).
    - Done when: `npm run build:spike` and `npm run check:spike-dist` exit 0 with `nargo` absent from `PATH`, and the sizes of the largest files are recorded in the Results_Document "Lookups" section.
    - Recorded in: Results_Document "Lookups".
    - _Requirements: 7.7, 11.2, 12.4, 12.5, 12.6_

  - [ ] 8.6 Commit group 8 files
    - Run `git status --short`. Stage by name: `vite.config.ts`, `scripts/check-spike-dist`, `package.json`, `docs/spike-results.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`. `public/_redirects` and `netlify.toml` are not changed by this group, and `public/_headers` must not exist. `dist/` is ignored and stays out. Commit with the message `feat(build): spike build mode, dist check and spike redirects`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit).
    - _Requirements: 11.2, 12.4, 12.5_

- [ ] 9. Deploy and Results_Document
  - Report the Netlify target to huynh and wait for confirmation, deploy as non-production, then write the Results_Document sections. The Results_Document is not declared complete here.
  - _Requirements: 10.7, 11.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.9, 12.10, 12.11, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [ ] 9.1 Rebuild the spike and check `dist/` before any deploy
    - Run `npm run build:spike` and `npm run check:spike-dist`. Confirm `dist/` holds only `spike.html`, the bundles derived from `src/zk/spike.ts`, the Artifact, `_redirects`, the two SRS `.dat` files, and the WASM and JavaScript assets the spike build references, and that no `_headers` exists.
    - If `dist/` contains any other file, STOP, list the unexpected files to huynh, and do not deploy until huynh confirms. An `index.html` or any other HTML file counts as unexpected.
    - Done when: both commands exit 0 and no unexpected file is listed.
    - _Requirements: 12.4, 12.5, 12.6_

  - [ ] 9.2 Read the Netlify power overview and report the deploy target
    - Load `power::netlify-deployment::overview` and record the lookup (L14) in "Lookups". Run `netlify status`. Report to huynh the site name and account name from its output, and state that the deploy will be non-production (`netlify deploy --dir dist`, no `--prod`, no `--build`) and that `dist/` contains only the spike page, its worker bundles, the Artifact, the SRS prefix, `_redirects` and the WASM files, with no private data.
    - If `netlify status` shows no linked site or account, report that and ask huynh which site and account to use. Create no deploy.
    - Done when: the site name and account name are in the message that ends task 9.3.
    - _Requirements: 12.1, 12.2, 1.10_

  - [ ] 9.3 STOP: deploy confirmation, wait for huynh to confirm the site and account
    - The agent must stop here, report the site name and account name from task 9.2, and wait for huynh's explicit written reply that confirms them. No later task may be started or batched with this one. Create no deploy before the reply.
    - If `netlify status` later shows a different site or account than the one huynh confirmed, or no linked site, stop again, create no deploy, and ask which site and account to use.
    - The deploy is non-production only. A production deploy happens only if huynh asks in writing.
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ] 9.4 Create the non-production Spike_Deploy
    - Run `netlify status` again and confirm it matches what huynh confirmed. Run `netlify deploy --dir dist` through the Netlify power with no `--prod`. Do not install or run any browser automation tool, and do not open the deployed page.
    - If the command fails or returns no deploy URL, STOP, report the command output to huynh, and do not retry as a production deploy.
    - The deploy publishes the local `dist/` folder, so no commit is needed or made before it.
    - Done when: the command returns a draft deploy URL.
    - _Requirements: 12.2, 12.3, 12.4, 12.9, 12.11_

  - [ ] 9.5 Record the deploy URL, date and versions
    - In `docs/spike-results.md` header, write the deploy URL, the deploy date in `YYYY-MM-DD` format, and update the version table with the installed version strings of `nargo`, `@noir-lang/noir_js`, `@noir-lang/acvm_js`, `@noir-lang/noirc_abi`, `@noir-lang/types`, `@aztec-foundation/bb.js`, Vite and Node taken from `nargo --version`, `npm ls` and `node --version`.
    - Done when: the URL, the date and all eight version strings are present.
    - Recorded in: Results_Document header.
    - _Requirements: 12.10, 13.2_

  - [ ] 9.6 Write the gate table text and the Cold_Run procedure
    - Under "Gate table" keep the two rows: `Normal_Gate: under 30 s` and `Throttled_Gate: under 60 s with Chrome DevTools 4x CPU throttling`, with every measured cell, Chrome version, machine and pass or fail cell empty and no placeholder, estimate or example number. Under "Cold_Run procedure" write the six ordered steps: open Chrome on huynh's Mac; open DevTools and enable "Disable cache" in the Network panel; set CPU throttling to "No throttling" for the Normal_Gate or "4x slowdown" for the Throttled_Gate; load the Spike_Deploy URL for the first time; press the run control once; read the timings from the Spike_Page. State that `bb.js` runs with `threads: 1`, that one Cold_Run supplies the numbers for each gate, that a gate passes only if its Cold_Run total is strictly below its target, and that failing either gate means switching to Option_B, which is Circom with snarkjs.
    - Done when: the section matches the text above and the table has no value in any measured cell.
    - Recorded in: Results_Document "Gate table", "Cold_Run procedure".
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.8_

  - [ ] 9.7 Write the "Spike-only files" section
    - List by repository-relative path every spike-only file: `spike.html`, `src/zk/spike.ts`, `src/zk/spike-worker.ts`, `src/zk/spike-protocol.ts`, `src/zk/spike-view.ts`, `src/zk/spike-report.ts`, `src/zk/spike-witness.ts`, `scripts/check-spike-dist`, `tests/zk/spike-report.test.ts`, `tests/zk/spike-view.test.ts`, `tests/zk/spike-witness.test.ts`, `tests/zk/results-document.test.ts`, `tests/zk/proof/proof-smoke.test.ts`, the `spike` branch of `vite.config.ts`, and the `build:spike` and `check:spike-dist` entries in `package.json`. Add the ordered removal steps: delete those files; delete the `spike` branch from `vite.config.ts` (keep `worker.format` and `build.target`); delete the two scripts from `package.json`; run `npm run build` and `npm test`; confirm no source, config, script or test file contains `spike.html` or `src/zk/spike.ts` (decision D5). State that the SRS files, `tests/zk/srs.test.ts`, `tests/zk/srs-wiring.test.ts` and `docs/spike-results.md` are not spike-only and are not in the removal steps. Include the result of task 8.4.
    - Done when: the section lists every path above and the removal steps are in order.
    - Recorded in: Results_Document "Spike-only files".
    - _Requirements: 11.3, 14.9_

  - [ ] 9.8 Write the "Browser steps for huynh" section
    - Write these numbered steps with the result cells blank (the `______` fill-in line, no value): (1) open Chrome, open the deploy URL, wait up to 10 s for the `RUN` control; (2) open DevTools, Network tab, tick "Disable cache", clear the log, reload, press `RUN` once; (3) after the run record number of requests, whether every request is same-origin, whether any request carries a body, whether any request went to `crs.aztec-cdn.foundation` or `crs.aztec-labs.com` (must be none), whether any request went to another origin; (4) confirm `CROSS ORIGIN ISOLATED (PAGE)` and `(WORKER)` both read `FALSE`; (5) copy the stage timings, `TOTAL` and `PROOF SIZE` into the gate table (Normal_Gate row), then repeat with CPU throttling "4x slowdown" for the Throttled_Gate row; (6) press `INVALID WITNESS`, wait up to 120 s, copy the displayed values into "Invalid-witness report"; (7) if there is no `RUN` control within 10 s, a `FAILED` result, or no result within 120 s, copy the stage name, the text and the URL and tell the Spike_Team; (8) run `node scripts/verify-srs.ts` and paste its output.
    - Write the "Invalid-witness report" section as a blank fill-in list: `EXECUTE THREW`, `RETURNED WITNESS`, `ERROR CONSTRUCTOR`, `ERROR PROPERTIES`, `ERROR MESSAGE`, `PRIVATE VALUE IN ERROR`, and the proof lines. Keep the Node pre-check from task 6.7 under its own labelled subheading.
    - The agent does not open the deployed page, press any control, review the network panel, or install or run any browser automation tool.
    - Done when: the section has the eight steps with blank result cells.
    - Recorded in: Results_Document "Browser steps for huynh", "Invalid-witness report".
    - _Requirements: 10.7, 12.7, 12.11, 13.7, 13.8, 14.7_

  - [ ] 9.9 Commit group 9 files
    - Runs after the STOP in task 9.3 and after tasks 9.4 to 9.8. The Results_Document is not declared complete here (task 10.7 does that). Run `git status --short`. Stage by name: `docs/spike-results.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`. `docs/spike-results.md` is the only group file besides the two tracking files (`dist/` is ignored; no source file changes in group 9). Commit with the message `docs(spike): deploy record and results document sections`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit).
    - _Requirements: 13.1, 13.2, 13.7_

- [ ] 10. Spike-only unit tests and the proof properties, before the Results_Document is declared complete
  - Run the remaining tests after the deploy and before the hand-over, so the blank-cell checks in the Results_Document stay true and no spike task starts after the stop.
  - _Requirements: 6.5, 6.6, 8.5, 8.9, 8.13, 8.14, 8.15, 8.16, 9.1, 9.2, 9.3, 9.4, 9.8, 13.3, 13.4, 13.7, 13.8, 13.9_

  - [ ] 10.1 Write `tests/zk/spike-report.test.ts`
    - Example test, runs under `npm test`. `modifyFirstSlotByOneCent` returns a copy with slot 0 amount plus 1, the frozen original is unchanged, and the modified amount stays below 2^40 and at or below the limit (9.1). `describeError` for an `Error`, a thrown string, a thrown number, `null` and an object with non-enumerable properties (9.2). `containsWholeToken` boundaries: a match inside a longer digit run is rejected, an underscore, a colon, a space, the string start and the string end are delimiters, the `0x` lowercase hexadecimal form matches case-insensitively (9.4). `findLeakedFields` returns the matching field names and an empty list when none match.
    - Done when: `npx vitest run tests/zk/spike-report.test.ts` exits 0.
    - _Requirements: 9.1, 9.2, 9.4_

  - [ ] 10.2 Write `tests/zk/spike-view.test.ts`
    - Example test, runs under `npm test`. Controls disabled while running and a second `run` event ignored (8.14); stage rows preserved on failure and `TOTAL` and proof size absent (8.9); the success view never contains `FAILED` (8.15); every copy string is uppercase and at most 10 words, counting the stage name and the slot number in the longest template (8.13); the `DEMO DATA` label is present in every state (8.16); timings are whole numbers and `TOTAL` is at least the sum of the five stages (8.5); a failure before `execute` and a timeout show no behaviour report values and leave the controls usable (9.8).
    - Done when: `npx vitest run tests/zk/spike-view.test.ts` exits 0.
    - _Requirements: 8.5, 8.9, 8.13, 8.14, 8.15, 8.16, 9.8_

  - [ ] 10.3 Write `tests/zk/results-document.test.ts`
    - Example test, runs under `npm test`. Reads `docs/spike-results.md` and fails unless: the eight headings are present in order; the gate table has exactly two data rows with the targets `under 30 s` and `under 60 s with Chrome DevTools 4x CPU throttling` and the eleven columns; every measured cell and the pass or fail cell is empty; the "Browser steps for huynh" result cells are blank; the five required sections exist ("Tests written first", "Lookups", "Invalid-witness report", "Spike-only files", "Browser steps for huynh"); the Cold_Run procedure lists the six steps in order.
    - Done when: `npx vitest run tests/zk/results-document.test.ts` exits 0.
    - _Requirements: 13.3, 13.4, 13.7, 13.8_

  - [ ] 10.4 Write `tests/zk/proof/proof.prop.test.ts` (Property 4)
    - **Property 4: A proof of a valid witness verifies**
    - Tag comment `Feature: zk-spike, Property 4: A proof of a valid witness verifies`. Seed `20261104`, `numRuns` exactly 3. For each valid witness: build inputs, execute, prove with `threads: 1` and the committed SRS, verify with `circuitVerify` returning true, and the three decoded public inputs equal `merkle_root`, `record_count` and `limit_cents`. No per-test timeout; the timeout comes from `vitest.proof.config.ts` (at least 3 times the sum of one proof and one verify, times 3 runs).
    - Done when: `npm run test:proof` exits 0 for this file and prints the seed.
    - **Validates: Requirements 6.5**
    - _Requirements: 6.5, 6.7_

  - [ ] 10.5 Write `tests/zk/proof/proof-tamper.prop.test.ts` (Property 5)
    - **Property 5: A proof does not verify against a changed public input**
    - Tag comment `Feature: zk-spike, Property 5: A proof does not verify against a changed public input`. Seed `20261105`, `numRuns` exactly 3, three variants per run. Each run proves once, then verifies three times, changing exactly one public input per variant (`merkle_root` to `(root + 1) mod p`, `record_count` plus 1 kept below 2^32, `limit_cents` plus 1 kept below 2^40) with the other two unchanged; verification must return false or throw in each variant. No per-test timeout in the file.
    - Done when: `npm run test:proof` exits 0 for this file and prints the seed.
    - **Validates: Requirements 6.6**
    - _Requirements: 6.6, 4.10, 6.7_

  - [ ] 10.6 Run all test commands and handle defects
    - Run `npm run typecheck`, `npm test`, `npm run test:proof` and `PATH="$HOME/.nargo/bin:$PATH" npm run test:circuit`. All must exit 0.
    - If a test in this group finds a defect in `spike-view.ts` or `spike-report.ts` (U17), fix it, add a regression example test, and append an entry to `tests/PBT-LOG.md` when a property found it. Because those modules are in the deployed page, a fix requires a new spike build and a new deploy: repeat tasks 9.1 to 9.5, including the confirmation stop in task 9.3, and update the deploy URL and date in the Results_Document. If a property finds a circuit defect, return to group 2 and pass the gate in group 3 again.
    - Done when: all four commands exit 0 and, if a redeploy was needed, the new URL and date are recorded.
    - _Requirements: 6.5, 6.6, 6.8, 8.9, 9.2_

  - [ ] 10.7 Declare the Results_Document complete
    - Read `docs/spike-results.md` once end to end: the eight headings are present, every measured, pass or fail and result cell is empty, the Lookups section lists every lookup made in this plan, "Tests written first" holds the saved first run and the final run. Make no pass or fail judgement. Confirm `public/_headers` does not exist and `netlify.toml` is unchanged. Search the files this plan added or changed (`src/`, `scripts/`, `tests/`, `circuits/`, `docs/spike-results.md`) for private key material, a signing function and a signing-library import, and for `console.*` calls and network APIs that could carry a posting field, leaf, root, limit or salt; record the clean result under "Lookups".
    - Done when: `npx vitest run tests/zk/results-document.test.ts` exits 0 and the read-through and the searches find nothing missing or unexpected.
    - Recorded in: Results_Document (declared complete), "Lookups".
    - _Requirements: 13.1, 13.8, 13.9, 12.6, 10.1, 10.3, 10.4, 10.5_

  - [ ] 10.10 Sync design.md with the path-rewrite Artifact and update U5
    - The design (`.kiro/specs/zk-spike/design.md`) still says in its Build_Script section that the script copies the compiled JSON and treats the cross-checkout determinism (U5) as a decision for huynh. Sync it with the decided behaviour: (a) the Build_Script rewrites absolute `file_map` paths to package-relative paths by textual replacement (prefix set: resolve and realpath forms, plain, forward-slash and JSON-escaped; longest first), keeps `bytecode`, `abi` and `hash` unchanged and checks them (raw-text comparison plus parsed comparison), and fails closed at step `path rewrite` on any remaining absolute repo or home path, invalid JSON, size-delta mismatch, or any absolute `file_map` path (starts with `/`, `~` or a drive letter); (b) U5 is RESOLVED (huynh's decision A, dated with the output of `date +%F`): the Artifact and Meta sha256 are identical across the repo and two other directories (record the three equal sha256 values `2b08fea5…ecd5b` / `d62b899b…34e01` and the paths used, as in `docs/spike-results.md` rows T4.3-c and T4.3-d); the fallback "strip file_map and debug_symbols" was not taken; (c) the Artifact_Meta format and the version string are unchanged; (d) the Requirement 7.2 sentence in the design now matches; (e) mention the known limits listed in the Results_Document `## Build_Script` section by reference; (f) the Risks table row U5 status changes to Resolved, and the Q8 text is updated.
    - Make no other change to `design.md` in this task: only these sections. Run `git diff .kiro/specs/zk-spike/design.md` to confirm the diff is confined to them, then run `validate_spec_format` on `design.md`.
    - Done when: those sections say the above and `validate_spec_format` on `design.md` reports no issues.
    - _Requirements: 7.2, 7.5_

  - [ ] 10.9 Commit group 10 files
    - Placed after task 10.7 and before the final stop task 10.8; the number 10.9 keeps every existing id unchanged. Run `git status --short`. Stage by name: `tests/zk/spike-report.test.ts`, `tests/zk/spike-view.test.ts`, `tests/zk/results-document.test.ts`, `tests/zk/proof/proof.prop.test.ts`, `tests/zk/proof/proof-tamper.prop.test.ts`, `docs/spike-results.md`, `.kiro/specs/zk-spike/design.md`, `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`. If task 10.6 fixed a defect, also stage by name the files it changed (for example `src/zk/spike-view.ts` or `src/zk/spike-report.ts`, a regression test, `tests/PBT-LOG.md`). Commit with the message `test(zk): spike-only unit tests, proof properties and completed results document`. Do not push.
    - Done when: `git log --oneline -1` shows that message and `git status --short` shows no remaining change to the files that this task stages (the two tracking files are staged, so the check holds at the moment of the commit; later status marks land in the next group-end commit). No commit is made if a "Done when" check of tasks 10.1 to 10.7 failed.
    - _Requirements: 6.5, 6.6, 13.9, 7.2, 7.5_

  - [ ] 10.8 STOP: hand over to huynh for the browser steps
    - The agent must stop here, report the path `docs/spike-results.md`, the Spike_Deploy URL and the deploy date to huynh, and wait for huynh to run the "Browser steps for huynh" and fill in every measured and result cell. No later task exists and none may be started. The agent makes no pass or fail judgement.
    - The agent does not open the deployed page, press the run control, review the network panel, or install or run any browser automation tool.
    - If huynh reports that the page shows no run control within 10 s, a FAILED result, or no result within 120 s of pressing the run control, record the failing stage, the displayed error text and the Spike_Deploy URL as reported by huynh in the Results_Document, report back, and do not mark the deploy as ready for measurement.
    - _Requirements: 10.7, 12.7, 12.8, 13.9_

## Notes

- Stop points: task 3.2 (soundness review gate, before the Artifact), task 9.3 (deploy confirmation of site and account), task 10.8 (hand-over for huynh's browser steps). Other stop-and-ask conditions sit inside the task they belong to: `nargo` not 1.0.0 (1.1), a missing package or version mismatch (1.2, 1.3), a Poseidon2 mismatch (2.8, 6.4), non-deterministic Artifact (4.3), a Grumpkin SRS needed (7.7), a slow default run (6.12), unexpected files in `dist/` (9.1), a different or missing Netlify site (9.2, 9.3), and a failed deploy (9.4).
- `nargo` lives under `~/.nargo/bin` and `bb` under `~/.bb`. The agent shell may not load huynh's profile, so every `nargo` command is run as `PATH="$HOME/.nargo/bin:$PATH" nargo ...` from `circuits/ledger_audit`.
- The order of the groups is binding. Nothing downstream of the Artifact starts before the go-ahead in task 3.2.
- The Results_Document is declared complete only after group 10 (task 10.7). The browser-dependent entries in `.kiro/steering/noir.md` (the `crossOriginIsolated` yes or no answer, and the browser observation that replaces the "Unverified" `execute` bullet) can only be finished after huynh fills in the measurements, so they are outside this plan.
- Commit points: task 0 (before task 1.1, the spec files and the two steering edits), and the last sub-task of each group except group 3: 1.7, 2.11 (before the soundness gate, so the review has a commit hash), 4.7, 5.7, 6.13, 7.16, 8.6, 9.9 and 10.9 (after task 10.7 and before the stop task 10.8). Group 3 changes no files and has no commit. From group 2 on, every group-end commit (2.11, 4.7, 5.7, 6.13, 7.16, 8.6, 9.9 and 10.9) also stages the two tracking files `.kiro/specs/zk-spike/tasks.md` and `.kiro/specs/zk-spike/tasks.meta.json`; both are tracked and never ignored, and the group 2 commit also carries the status changes left uncommitted since group 1. The mid-group commits in tasks 4.6 and 5.6 do not stage them. Task 4.6 commits the Artifact and Artifact_Meta and task 5.6 commits the SRS files with `.gitattributes`, so tasks 4.7 and 5.7 commit only the rest of their groups plus the two tracking files. Files are staged by name, with no `git add -A` or `git add .`.
- Nothing is pushed by any task; huynh pushes. No task amends, rebases, force-pushes or rewrites history, or skips hooks. A fix after a commit, including a circuit change after the soundness review, goes in a new commit.
- The deploy in task 9.4 publishes the local `dist/` folder and needs no commit before it.
- Task 10.9 sits before task 10.8 in the document so that no existing task id changes.
- Task 7.9 rule (1) exempts `tests/support/zk-env.ts` for `createProverEnv` (found in task 6.3).
- Artifact path rewrite (huynh's decision A on U5, after task 4.3): the Build_Script rewrites the absolute source paths in `file_map` to package-relative paths by textual replacement, so builds from different directories are identical. Requirement 7.2 carries the one-sentence addition; `bytecode` and `abi` are copied unchanged. Tasks 4.1, 4.2, 4.3 and 4.5 are amended accordingly.
- huynh's decisions after groups 4 and 5: (1) a generic absolute-path check in the Build_Script, added as the first sub-task of group 6 (task 6.0); (2) a design sync in group 10 (task 10.10, the only task allowed to edit `design.md`); (3) the Build_Script known limits recorded in the Results_Document `## Build_Script` section (task 6.0).
- Order of the new tasks: task 6.0 is the first sub-task of group 6, before 6.1. Task 10.10 sits after task 10.7 and before task 10.9 in the document (and before the final stop task 10.8), so it runs before the group 10 commit and no existing id changes.
- Task 7.14 split `src/zk/spike-classify.ts` from the worker; task 7.16 stages it (found in task 7.14). The spike build emits bb.js worker chunks `main.worker-*.js` and `thread.worker-*.js` that the dist check must allow (found in task 7.15).

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
    { "id": 7, "tasks": ["1.7"] },
    { "id": 8, "tasks": ["2.1"] },
    { "id": 9, "tasks": ["2.2"] },
    { "id": 10, "tasks": ["2.3"] },
    { "id": 11, "tasks": ["2.4"] },
    { "id": 12, "tasks": ["2.5"] },
    { "id": 13, "tasks": ["2.6"] },
    { "id": 14, "tasks": ["2.7"] },
    { "id": 15, "tasks": ["2.8"] },
    { "id": 16, "tasks": ["2.9"] },
    { "id": 17, "tasks": ["2.10"] },
    { "id": 18, "tasks": ["2.11"] },
    { "id": 19, "tasks": ["3.1"] },
    { "id": 20, "tasks": ["3.2"] },
    { "id": 21, "tasks": ["4.1"] },
    { "id": 22, "tasks": ["4.2"] },
    { "id": 23, "tasks": ["4.3"] },
    { "id": 24, "tasks": ["4.4"] },
    { "id": 25, "tasks": ["4.5"] },
    { "id": 26, "tasks": ["4.6"] },
    { "id": 27, "tasks": ["4.7"] },
    { "id": 28, "tasks": ["5.1"] },
    { "id": 29, "tasks": ["5.2"] },
    { "id": 30, "tasks": ["5.3"] },
    { "id": 31, "tasks": ["5.4"] },
    { "id": 32, "tasks": ["5.5"] },
    { "id": 33, "tasks": ["5.6"] },
    { "id": 34, "tasks": ["5.7"] },
    { "id": 35, "tasks": ["6.0"] },
    { "id": 36, "tasks": ["6.1"] },
    { "id": 37, "tasks": ["6.2"] },
    { "id": 38, "tasks": ["6.3"] },
    { "id": 39, "tasks": ["6.4"] },
    { "id": 40, "tasks": ["6.5"] },
    { "id": 41, "tasks": ["6.6"] },
    { "id": 42, "tasks": ["6.7"] },
    { "id": 43, "tasks": ["6.8"] },
    { "id": 44, "tasks": ["6.9"] },
    { "id": 45, "tasks": ["6.10"] },
    { "id": 46, "tasks": ["6.11"] },
    { "id": 47, "tasks": ["6.12"] },
    { "id": 48, "tasks": ["6.13"] },
    { "id": 49, "tasks": ["7.1"] },
    { "id": 50, "tasks": ["7.2"] },
    { "id": 51, "tasks": ["7.3"] },
    { "id": 52, "tasks": ["7.4"] },
    { "id": 53, "tasks": ["7.5"] },
    { "id": 54, "tasks": ["7.6"] },
    { "id": 55, "tasks": ["7.7"] },
    { "id": 56, "tasks": ["7.8"] },
    { "id": 57, "tasks": ["7.9"] },
    { "id": 58, "tasks": ["7.10"] },
    { "id": 59, "tasks": ["7.11"] },
    { "id": 60, "tasks": ["7.12"] },
    { "id": 61, "tasks": ["7.13"] },
    { "id": 62, "tasks": ["7.14"] },
    { "id": 63, "tasks": ["7.15"] },
    { "id": 64, "tasks": ["7.16"] },
    { "id": 65, "tasks": ["8.1"] },
    { "id": 66, "tasks": ["8.2"] },
    { "id": 67, "tasks": ["8.3"] },
    { "id": 68, "tasks": ["8.4"] },
    { "id": 69, "tasks": ["8.5"] },
    { "id": 70, "tasks": ["8.6"] },
    { "id": 71, "tasks": ["9.1"] },
    { "id": 72, "tasks": ["9.2"] },
    { "id": 73, "tasks": ["9.3"] },
    { "id": 74, "tasks": ["9.4"] },
    { "id": 75, "tasks": ["9.5"] },
    { "id": 76, "tasks": ["9.6"] },
    { "id": 77, "tasks": ["9.7"] },
    { "id": 78, "tasks": ["9.8"] },
    { "id": 79, "tasks": ["9.9"] },
    { "id": 80, "tasks": ["10.1"] },
    { "id": 81, "tasks": ["10.2"] },
    { "id": 82, "tasks": ["10.3"] },
    { "id": 83, "tasks": ["10.4"] },
    { "id": 84, "tasks": ["10.5"] },
    { "id": 85, "tasks": ["10.6"] },
    { "id": 86, "tasks": ["10.7"] },
    { "id": 87, "tasks": ["10.10"] },
    { "id": 88, "tasks": ["10.9"] },
    { "id": 89, "tasks": ["10.8"] }
  ]
}
```

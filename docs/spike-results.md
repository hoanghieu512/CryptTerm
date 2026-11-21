# ZK spike results

## Header

Deploy URL:

Deploy date:

### Version table

| Component | Version | Source |
|-----------|---------|--------|
| `nargo` | 1.0.0 | `nargo --version` |
| `bb` (CLI, extra row) | 6.0.0 | `~/.bb/bb --version` |
| `@noir-lang/noir_js` | 1.0.0 | `npm ls` |
| `@noir-lang/acvm_js` | 1.0.0 | `npm ls` |
| `@noir-lang/noirc_abi` | 1.0.0 | `npm ls` |
| `@noir-lang/types` | 1.0.0 | `npm ls` |
| `@aztec-foundation/bb.js` | 6.0.0 | `npm ls` |
| Vite | 8.3.8 | `npm ls vite` |
| Node | v24.14.1 | `node --version` |
| npm (extra row) | 11.11.0 | `npm --version` |

### Toolchain check output

Date of the checks: 2026-11-20.

#### `PATH="$HOME/.nargo/bin:$PATH" nargo --version`

```
nargo version = 1.0.0
noirc version = 1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c
(git version hash: 275d3ab1a5c916c6ea73e8d6b943f685f574500c, is dirty: false)
```

#### `~/.bb/bb --version`

```
6.0.0
```

#### `node --version`

```
v24.14.1
```

#### `npm --version`

```
11.11.0
```

#### `npm view @noir-lang/noir_js dist-tags`

```
{
  aztec: '0.18.0-6ca33a2.aztec',
  latest: '1.0.0',
  nightly: '1.0.0-17983bc.nightly'
}
```

#### `npm view @noir-lang/noir_js@1.0.0 version dist.tarball`

```
version = '1.0.0'
dist.tarball = 'https://registry.npmjs.org/@noir-lang/noir_js/-/noir_js-1.0.0.tgz'
```

#### `npm view @noir-lang/acvm_js dist-tags`

```
{
  aztec: '0.30.0-6ca33a2.aztec',
  latest: '1.0.0',
  nightly: '1.0.0-17983bc.nightly'
}
```

#### `npm view @noir-lang/acvm_js@1.0.0 version dist.tarball`

```
version = '1.0.0'
dist.tarball = 'https://registry.npmjs.org/@noir-lang/acvm_js/-/acvm_js-1.0.0.tgz'
```

#### `npm view @noir-lang/noirc_abi dist-tags`

```
{
  aztec: '0.18.0-6ca33a2.aztec',
  latest: '1.0.0',
  nightly: '1.0.0-17983bc.nightly'
}
```

#### `npm view @noir-lang/noirc_abi@1.0.0 version dist.tarball`

```
version = '1.0.0'
dist.tarball = 'https://registry.npmjs.org/@noir-lang/noirc_abi/-/noirc_abi-1.0.0.tgz'
```

#### `npm view @noir-lang/types dist-tags`

```
{
  aztec: '0.18.0-6ca33a2.aztec',
  latest: '1.0.0',
  nightly: '1.0.0-17983bc.nightly'
}
```

#### `npm view @noir-lang/types@1.0.0 version dist.tarball`

```
version = '1.0.0'
dist.tarball = 'https://registry.npmjs.org/@noir-lang/types/-/types-1.0.0.tgz'
```

#### `npm view @aztec-foundation/bb.js dist-tags`

```
{ prerelease: '6.1.0-nightly.20261120', latest: '6.1.0' }
```

#### `npm view @aztec-foundation/bb.js@6.0.0 version dist.tarball`

```
version = '6.0.0'
dist.tarball = 'https://registry.npmjs.org/@aztec-foundation/bb.js/-/bb.js-6.0.0.tgz'
```

#### `npm ls @noir-lang/noir_js @aztec-foundation/bb.js`

```
cryptterm@0.0.0 /Users/lavopavden/Dev/projects/CryptTerm
├── @aztec-foundation/bb.js@6.0.0
└── @noir-lang/noir_js@1.0.0
```

#### `npm ls @noir-lang/noir_js @noir-lang/acvm_js @noir-lang/noirc_abi @noir-lang/types @aztec-foundation/bb.js`

```
cryptterm@0.0.0 /Users/lavopavden/Dev/projects/CryptTerm
├── @aztec-foundation/bb.js@6.0.0
├── @noir-lang/acvm_js@1.0.0
├─┬ @noir-lang/noir_js@1.0.0
│ ├── @noir-lang/acvm_js@1.0.0 deduped
│ ├── @noir-lang/noirc_abi@1.0.0 deduped
│ └── @noir-lang/types@1.0.0 deduped
├─┬ @noir-lang/noirc_abi@1.0.0
│ └── @noir-lang/types@1.0.0 deduped
└── @noir-lang/types@1.0.0
```

#### `npm ls @aztec/bb.js`

The package is absent, which is the expected outcome.

```
cryptterm@0.0.0 /Users/lavopavden/Dev/projects/CryptTerm
└── (empty)
```

#### `npm ls vite`

```
cryptterm@0.0.0 /Users/lavopavden/Dev/projects/CryptTerm
├─┬ @vitejs/plugin-react@6.3.0
│ └── vite@8.3.8 deduped
├── vite@8.3.8
└─┬ vitest@5.1.1
  ├─┬ @vitest/mocker@5.1.1
  │ └── vite@8.3.8 deduped
  └── vite@8.3.8 deduped
```

## Gate table

| Target | Cold_Run total (ms) | WASM INIT (ms) | WITNESS PREP (ms) | EXECUTE (ms) | PROVE (ms) | VERIFY (ms) | Proof size (bytes) | Chrome version | Machine | Pass or fail |
|--------|---------------------|----------------|-------------------|--------------|------------|-------------|--------------------|----------------|---------|--------------|
| Normal_Gate: under 30 s | | | | | | | | | | |
| Throttled_Gate: under 60 s with Chrome DevTools 4x CPU throttling | | | | | | | | | | |

## Cold_Run procedure

1. Open Chrome on huynh's Mac.
2. Open DevTools and enable "Disable cache" in the Network panel.
3. Set CPU throttling to "No throttling" for the Normal_Gate, or to "4x slowdown" for the Throttled_Gate.
4. Load the Spike_Deploy URL for the first time.
5. Press the run control once.
6. Read the timings from the Spike_Page.

`bb.js` runs with `threads: 1`. One Cold_Run supplies the numbers for each gate. A gate passes only if its Cold_Run total is strictly below its target. Failing either gate means switching to Option B, which is Circom with snarkjs.

## Tests written first

*Filled in by tasks 2.5 (first run against the constraint-free skeleton) and 2.9 (final run and source inspection).*

### Written-first run (constraint-free skeleton, 13 tests)

Date and time: 2026-11-20 20:57:11 (local time on huynh's Mac).

`nargo --version`:

```
nargo version = 1.0.0
noirc version = 1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c
(git version hash: 275d3ab1a5c916c6ea73e8d6b943f685f574500c, is dirty: false)
```

Command, run from the repository root (without `--deny-warnings`, with `NO_COLOR=1` and `PATH="$HOME/.nargo/bin:$PATH"`):

```
npm run test:circuit
```

`nargo` 1.0.0 printed ANSI colour codes even with `NO_COLOR=1`. The only change to the output below is that those escape sequences (`ESC[0m`, `ESC[31m` and similar) were removed with `sed`. No line was removed, added or reordered, and all warnings are kept.

Output (stdout and stderr together):

```

> cryptterm@0.0.0 test:circuit
> cd circuits/ledger_audit && nargo test

warning: unused variable merkle_root
   ┌─ src/main.nr:23:5
   │
23 │     merkle_root: pub Field,
   │     ----------- unused variable
   │

warning: unused variable record_count
   ┌─ src/main.nr:24:5
   │
24 │     record_count: pub u32,
   │     ------------ unused variable
   │

warning: unused variable limit_cents
   ┌─ src/main.nr:25:5
   │
25 │     limit_cents: pub u64,
   │     ----------- unused variable
   │

warning: unused variable postings
   ┌─ src/main.nr:26:5
   │
26 │     postings: [Posting; N],
   │     -------- unused variable
   │

warning: unused global AMOUNT_BOUND
   ┌─ src/main.nr:11:8
   │
11 │ global AMOUNT_BOUND: u64 = 1099511627776; // 2^40, exclusive upper bound
   │        ------------ unused global
   │

[ledger_audit] Running 13 test functions
[ledger_audit] Testing tests::wrong_root_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::limit_at_2_pow_40_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::valid_batch_passes ... ok
[ledger_audit] Testing tests::over_limit_flagged_passes ... ok
[ledger_audit] Testing tests::nonzero_padding_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::amount_2_pow_40_minus_1_passes ... ok
[ledger_audit] Testing tests::amount_at_2_pow_40_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::unbalanced_by_one_cent_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::record_count_0_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::over_limit_unflagged_fails ... FAIL
error: Test passed when it should have failed

[ledger_audit] Testing tests::amount_equal_limit_unflagged_passes ... ok
[ledger_audit] Testing tests::record_count_64_passes ... ok
[ledger_audit] Testing tests::record_count_65_fails ... FAIL
error: Test passed when it should have failed


[ledger_audit] Failures:
     tests::wrong_root_fails
     tests::limit_at_2_pow_40_fails
     tests::nonzero_padding_fails
     tests::amount_at_2_pow_40_fails
     tests::unbalanced_by_one_cent_fails
     tests::record_count_0_fails
     tests::over_limit_unflagged_fails
     tests::record_count_65_fails

[ledger_audit] 5 tests passed, 8 tests failed
```

Exit status: 1

Result: against the constraint-free `main`, the eight `_fails` tests failed and the five `_passes` tests passed (5 tests passed, 8 tests failed).

### Final run (all constraints, 20 tests)

Date and time: 2026-11-20 21:31:52 (local time on huynh's Mac).

`nargo --version`:

```
nargo version = 1.0.0
noirc version = 1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c
(git version hash: 275d3ab1a5c916c6ea73e8d6b943f685f574500c, is dirty: false)
```

Command, run from the repository root (without `--deny-warnings`, with `PATH="$HOME/.nargo/bin:$PATH"`):

```
npm run test:circuit
```

`nargo` 1.0.0 printed ANSI colour codes. The only change to the output below is that those escape sequences were removed with `sed`. No line was removed, added or reordered. The run printed no warnings.

Output (stdout and stderr together):

```

> cryptterm@0.0.0 test:circuit
> cd circuits/ledger_audit && nargo test

[ledger_audit] Running 20 test functions
[ledger_audit] Testing tests::node_hash_matches_bb_js ... ok
[ledger_audit] Testing tests::padding_leaf_matches_bb_js ... ok
[ledger_audit] Testing tests::leaf_hash_matches_bb_js ... ok
[ledger_audit] Testing tests::empty_root_matches_bb_js ... ok
[ledger_audit] Testing tests::over_limit_flagged_passes ... ok
[ledger_audit] Testing tests::amount_equal_limit_unflagged_passes ... ok
[ledger_audit] Testing tests::record_count_65_fails ... ok
[ledger_audit] Testing tests::record_count_0_fails ... ok
[ledger_audit] Testing tests::over_limit_unflagged_fails ... ok
[ledger_audit] Testing tests::unbalanced_by_one_cent_fails ... ok
[ledger_audit] Testing tests::side_value_2_fails ... ok
[ledger_audit] Testing tests::valid_batch_passes ... ok
[ledger_audit] Testing tests::amount_2_pow_40_minus_1_passes ... ok
[ledger_audit] Testing tests::nonzero_padding_fails ... ok
[ledger_audit] Testing tests::padding_nonzero_salt_fails ... ok
[ledger_audit] Testing tests::limit_at_2_pow_40_fails ... ok
[ledger_audit] Testing tests::amount_at_2_pow_40_fails ... ok
[ledger_audit] Testing tests::record_count_64_passes ... ok
[ledger_audit] Testing tests::review_flag_value_2_fails ... ok
[ledger_audit] Testing tests::wrong_root_fails ... ok
[ledger_audit] 20 tests passed
```

Exit status: 0

Result: with all ten constraints and the seven extension tests, 20 tests passed, none failed, none skipped.

`nargo compile`, run from `circuits/ledger_audit` with `PATH="$HOME/.nargo/bin:$PATH"`:

```
nargo compile
```

Output: none. The command printed nothing (0 bytes on stdout and stderr), so there are no errors and no warnings.

Exit status: 0

### Source inspection

Scope: `circuits/ledger_audit/Nargo.toml` and all six files under `circuits/ledger_audit/src/` (`main.nr`, `posting.nr`, `hash.nr`, `merkle.nr`, `test_support.nr`, `tests.nr`; tests included). Run on 2026-11-20. No finding is a violation.

#### a. No `unconstrained` function (Requirement 4.8)

Commands, from `circuits/ledger_audit`:

```
grep -rnE 'unconstrained|#\[oracle|unconstrained fn|unconstrained \{' src Nargo.toml
grep -rnE 'oracle' src Nargo.toml
```

Result: both commands matched nothing (grep exit 1, no output). There is no `unconstrained` keyword, no `unconstrained fn`, no `unconstrained {` block and no `#[oracle` attribute anywhere in the package. Pass.

#### b. No `i8`, `i16`, `i32`, `i64` or float type (Requirement 4.9)

Commands, from `circuits/ledger_audit`:

```
grep -rnE '\bi(8|16|32|64)\b' src Nargo.toml
grep -rnE '\bf(32|64)\b|float' src Nargo.toml
grep -nE 'amount:|limit_cents:|record_count:' src/*.nr
```

Result: the first two commands matched nothing (grep exit 1). No signed integer type and no float type appears anywhere in the package. The declared types are:

| Value | Declaration | Type |
|-------|-------------|------|
| `amount` | `src/posting.nr:6` `pub amount: u64` (the `Posting` field) | `u64` |
| `limit_cents` | `src/main.nr:32` `limit_cents: pub u64` | `u64` |
| `record_count` | `src/main.nr:31` `record_count: pub u32` | `u32` |

The other `amount:` matches in `src/test_support.nr:29` and `src/tests.nr` (lines 37, 63, 125, 200) are a `u64` helper parameter or struct-literal fields of the same `Posting` field. Pass.

#### c. `N` is the only capacity constant (Requirement 2.2)

Command, from `circuits/ledger_audit`:

```
grep -rnwE '64' src Nargo.toml
```

`-w` matches the standalone token `64` only. Words such as `u64` and `TWO_POW_64` are not matches, because the `64` is part of a longer word. Nine lines match. Classification:

| Location | Text | Class |
|----------|------|-------|
| `src/main.nr:11` | `global N: u32 = 64; // Capacity. ...` | The definition of `N`. The only capacity literal. |
| `src/hash.nr:3` | comment `... starts at input_length * 2^64 ...` | Hash constant `2^64` (initial capacity multiplier), in a comment. |
| `src/hash.nr:9` | comment `// 2^64, the initial capacity multiplier.` | Hash constant `2^64`, in a comment. The constant itself is `TWO_POW_64` (line 10), not a `64` token. |
| `src/hash.nr:12` | comment `... [left, right, 0, 2 * 2^64] ...` | Hash constant `2^64`, in a comment. |
| `src/test_support.nr:14` | comment `... the tests use 10 and 64` | Comment naming the record counts the tests use. Test input, not a constant. |
| `src/tests.nr:28` | comment `// root of 64 PAD_LEAF leaves ...` | Comment describing the `EMPTY_ROOT` vector. Test documentation, not a constant. |
| `src/tests.nr:145`, `146` | `base_postings(64)` and `main(root_of(p), 64, LIMIT, p)` in `record_count_64_passes` | Test input naming the record count. |
| `src/tests.nr:158` | `base_postings(64)` in `record_count_65_fails` | Test input naming the record count (a full batch, with the count then set to 65). |

Conclusion: no non-test, non-hash use of the literal `64` exists outside `global N`. In non-test, non-comment code the literal `64` appears once, in `global N: u32 = 64`. The `64` in `hash.nr` is only in comments (the value is held in `TWO_POW_64`), and all other matches are in `test_support.nr` and `tests.nr`.

Size constants: `DEPTH` is the only other size constant (`src/main.nr:12`, `global DEPTH: u32 = 6`). It is guarded by `std::static_assert(1 << DEPTH == N, "DEPTH DOES NOT MATCH CAPACITY")` in `check_depth()` (`src/main.nr:20`), which runs at compile time through `pub global DEPTH_MATCHES_CAPACITY` (`src/main.nr:17`; see T2.1-h). `merkle.nr` derives every level length from `N` (`N / 2` to `N / 32`, and `1` for the root) and guards each step with `static_assert(IN == 2 * OUT, ...)`. The remaining global constants are not sizes: `AMOUNT_BOUND` (2^40 bound), `TWO_POW_64` (hash constant), the side and flag values in `posting.nr`, `LIMIT`, `TWO_POW_40` and the six hex known-answer vectors in the tests. The array length `6` in `[Field; 6]` (`posting.nr:30`, `hash.nr:19`, `tests.nr:224`) is the number of leaf fields, not a capacity. Pass.

## Build_Script

`scripts/build-circuit` compiles `circuits/ledger_audit`, rewrites the absolute source paths of the compiled JSON by textual replacement, and writes the Artifact and Artifact_Meta (see tasks 4.1 to 4.4 and 6.0). Requirements 7.2, 7.4 and 7.5.

### Known limits (accepted by huynh)

- A `.tmp-<pid>` file left by a killed run (SIGKILL, power loss) is never cleaned up, because the suffix is the pid.
- A kill between the two renames leaves the new Artifact with the old Meta. Only the checksum test (Requirement 7.8) notices.
- The restore path after a failed second rename has no test.
- `target/ledger_audit.json` is not deleted before `nargo compile`, so a stale file would be read as fresh if nargo exited 0 without writing a new one (the "artifact missing" case only triggers on a clean checkout).
- An unexpected non-step error is labelled with whatever step was running (for example EACCES at the read step), and a missing `nargo` is reported as step `version`.
- The Windows path forms (`\\`-escaped and forward-slash) are implemented but were not run on Windows.

Two further limits found in tasks 4.1 and 4.4 are CLOSED by the generic absolute-path check added in task 6.0: an absolute path outside the repo and the home directory was accepted, and an unknown path form (for example a symlinked `/tmp/...` against `/private/tmp/...`) could slip through. The check runs at step `path rewrite`: after the textual replacement and the existing checks it parses the rewritten text (a check only, the output stays the textual replacement) and fails with exit 1, no change to `src/zk/artifacts/` and no `.tmp-*` file, if any `file_map[*].path`, or any `path` value nested in a `file_map` entry, starts with `/`, `\` or `~`, or matches `^[A-Za-z]:[\\/]`. The message names the `file_map` key and the form (`absolute`, `tilde`, `drive`). Evidence: T6.0-x in "Lookups".

## Lookups

*Register entries from the design. Tasks that look up an API add their own rows.*

| ID | Topic | Source | Version |
|----|-------|--------|---------|
| L1 | `Barretenberg.new`, `skipSrsInit`, `initSRSChonk`, `srsInitSrs`, `BackendType.Wasm`, WASM threads selection | `npm pack @aztec-foundation/bb.js@6.0.0`: `src/barretenberg/index.ts`, `src/bb_backends/wasm.ts`, `src/barretenberg_wasm/*` | bb.js 6.0.0 |
| L2 | `BackendOptions` (`threads`, `skipSrsInit`, `wasmPath`, `crsPath`, `srsSize`) | same package, `src/bb_backends/index.ts` | bb.js 6.0.0 |
| L3 | CRS hosts, file names, Range request, bytes per point | same package, `src/crs/net_crs.ts`, `src/crs/browser/cached_net_crs.ts`, `src/crs/node/index.ts` | bb.js 6.0.0 |
| L4 | `poseidon2Hash`, `poseidon2Permutation`, `srsInitSrs`, `circuitStats`, `circuitProve`, `circuitVerify`, `circuitComputeVk` types | same package, `dest/node/cbind/generated/api_types.d.ts`, `async.d.ts` | bb.js 6.0.0 |
| L5 | `SrsInitSrs` checks, 4 MiB chunk hashes, prover key size, `SUBGROUP_SIZE`, "too many points" error, `circuitStats` fields | `AztecProtocol/aztec-packages` tag `v6.0.0`: `barretenberg/cpp/src/barretenberg/bbapi/bbapi_srs.cpp`, `bbapi_ultra_honk.cpp`, `srs/factories/bn254_g1_chunk_hashes.hpp`, `srs/factories/mem_bn254_crs_factory.cpp`, `ultra_honk/ultra_prover.cpp`, `ecc/curves/bn254/bn254.hpp` | bb 6.0.0 source |
| L6 | `Noir.execute`, error enrichment | `npm pack @noir-lang/noir_js@1.0.0`: `lib/program.mjs`, `lib/witness_generation.mjs` | noir_js 1.0.0 |
| L7 | ABI encode and decode, init functions | `@noir-lang/noirc_abi@1.0.0` and `@noir-lang/acvm_js@1.0.0` (`web/*.d.ts`, `web/*.js`); `noir-lang/noir` tag `v1.0.0`: `tooling/noirc_abi/src/input_parser/{mod,json}.rs`, `tooling/noirc_abi_wasm/src/lib.rs` | 1.0.0 |
| L8 | `InputValue`, `CompiledCircuit` types | `@noir-lang/types@1.0.0`, `lib/esm/types.d.ts` | 1.0.0 |
| L9 | `poseidon2_permutation` (public), `Poseidon2Hasher` (`pub(crate)`), known-answer values | `noir-lang/noir` tag `v1.0.0`: `noir_stdlib/src/hash/mod.nr`, `noir_stdlib/src/hash/poseidon2.nr` | Noir 1.0.0 |
| L10 | `#[test(should_fail_with = "...")]` is a substring match; `#[test]` with arguments is a fuzz test; assertion messages; integer overflow errors; `assert_max_bit_size` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/tooling/tests.md`, `docs/docs/language/assert.md`, `docs/docs/language/data_types/{integers,fields}.md` | Noir 1.0.0 |
| L11 | `noir-lang/poseidon` tags v0.2.6 to v0.4.0, changelog | `github.com/noir-lang/poseidon` | tags v0.2.6, v0.3.0, v0.4.0 |
| L12 | Vite worker constructor, `worker.format`, `build.rolldownOptions.input`, top-level `input`, `?url`, `publicDir`, `assetsInlineLimit` | Context7 `/vitejs/vite/v8.3.5` (docs for Vite 8.3.5; the repo pins 8.3.8) | Vite 8.3.5 docs |
| L13 | Aztec Ignition ceremony | `github.com/AztecProtocol/ignition-verification` | n/a |
| L14 | Netlify CLI flow | Netlify power `netlify-deployment` overview | n/a |
| L16 | Vitest config discovery (`vitest.config.*` then `vite.config.*`, `--config`), `exclude` replaces the default list and is extended with `configDefaults.exclude`, `include`, `testTimeout`, `hookTimeout`, `fileParallelism`, `vitest list` | Context7 `/vitest-dev/vitest/v5.0.3` (`docs/config/index.md`, `docs/config/exclude.md`; the nearest listed version to the pinned 5.1.1), checked against the installed package `node_modules/vitest` 5.1.1: `dist/chunks/defaults.*.js` (`defaultExclude`), `dist/chunks/constants.*.js` (`CONFIG_NAMES`), `dist/chunks/cac.*.js` (CLI options and commands), `dist/chunks/index.*.js` (`testTimeout` default) | Vitest 5.1.1 |
| E-1 | Poseidon2 parity | scratch script on bb.js 6.0.0, WASM backend | 2026-11-19 |
| E-2 | `srsInitSrs` timing and acceptance with local ceremony prefixes | scratch script | 2026-11-19 |
| E-3 | `abiEncode` probe with a hand-written ABI | scratch script on noirc_abi 1.0.0 | 2026-11-19 |
| E-4 | Known-answer values and hash timing | scratch script | 2026-11-19 |
| E-5 | HEAD and 64 KiB Range requests against both CRS hosts, and comparison with the local bb cache | `curl` | 2026-11-19 |
| E-6 | `npm ls` of the five pinned packages and `import('@noir-lang/noir_js')` in Node 24 | scratch install | 2026-11-19 |
| E-7 | `~/.nargo/bin/nargo --version`, `~/.bb/bb --version`, `ls ~/.nargo/bin`, `command -v nargo` (design session shell and clean `env -i /bin/bash`), and `--help` of `nargo`, `nargo compile`, `nargo test`, `nargo check` (read-only; no `nargo new`, `compile` or `test` was run) | shell | 2026-11-20 |
| T2.1-a | Struct and struct field visibility (`pub struct`, `pub` fields, private by default); used by `Posting` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/structs.md`, section "Visibility" | Noir 1.0.0 |
| T2.1-b | `global` with an integer type, use of a `u32` global as an array length, `pub global` visibility | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/globals.md` | Noir 1.0.0 |
| T2.1-c | `static_assert`: signature `pub fn static_assert<T>(predicate: bool, message: T)` takes a required message, is not in the prelude (call as `std::static_assert`), and statements cannot sit at module level | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/assert.md`, `noir_stdlib/src/lib.nr`, `noir_stdlib/src/prelude.nr`, `test_programs/compile_success_empty/static_assert/src/main.nr` | Noir 1.0.0 |
| T2.1-d | `pub` modifier on `main` parameters (public inputs, `main` only), no return value | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/index.md`, section "pub Modifier" | Noir 1.0.0 |
| T2.1-e | `compiler_version` in `Nargo.toml`: parsed by `semver::VersionReq::parse`, compared to the compiler version with the pre-release part stripped, so `"=1.0.0"` is a valid requirement. Examples use `[package]` with `name`, `type = "bin"`, `authors = [""]`, `compiler_version` | `noir-lang/noir` tag `v1.0.0`: `tooling/nargo_toml/src/semver.rs`, `test_programs/compile_success_empty/static_assert/Nargo.toml` | Noir 1.0.0 |
| T2.1-f | `mod name;` declaration (file `src/name.nr`) and `use crate::name::Item;` import syntax | `noir-lang/noir` tag `v1.0.0`: `docs/docs/project_structure/modules.md` | Noir 1.0.0 |
| T2.1-g | `nargo check` and `nargo compile` options (`nargo check --help` lists `--overwrite`, which is why `nargo check` writes `Prover.toml` into the package) | `nargo check --help`, `nargo compile --help` on the installed binary | nargo 1.0.0 |
| T2.1-h | Experiment: where `static_assert` can run. A `static_assert` in a function that is never called does not fire. A plain `global X: bool = check_depth();` and a `pub global` of the same form fire at compile time (`error: static_assert failed`). A `comptime global` and a `pub(crate) global` of that form did not fire in the scratch run. The package uses `pub global DEPTH_MATCHES_CAPACITY`. Confirmed on the real file: setting `DEPTH` to 7 gives `error: static_assert failed: DEPTH DOES NOT MATCH CAPACITY` | scratch package in `/tmp/scratch/s1` (deleted afterwards), then `circuits/ledger_audit` with `nargo compile` | nargo 1.0.0, 2026-11-20 |
| T2.2-a | `std::hash::poseidon2_permutation<let N: u32>(input: [Field; N]) -> [Field; N]` is public, `N` must equal the state size (4 on BN254, enforced by a `static_assert`), it is only the permutation and not a hash; doc example `poseidon2_permutation([0, 1, 2, 3])[0]` equals `0x01BD538C…1737`; `Poseidon2Hasher` module stays `pub(crate)`. Imported as `use std::hash::poseidon2_permutation;` | `noir-lang/noir` tag `v1.0.0`: `noir_stdlib/src/hash/mod.nr` | Noir 1.0.0 |
| T2.2-b | Numeric generics `fn f<let IN: u32, let OUT: u32>(x: [Field; IN]) -> [Field; OUT]`; "no type-inference for type-level integers" applies to literal arguments (default `u32`); arithmetic on generics in type position (`+ - * / %`) is best effort | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/generics.md` | Noir 1.0.0 |
| T2.2-c | Array syntax: `[0; OUT]` repeat form, `let mut next = ...; next[j] = ...;` element assignment, indexing with `u32`, dynamic versus constant index, `for j in 0..OUT` range loop (constant bounds required in constrained code) | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/arrays.md`, `docs/docs/language/control_flow.md` | Noir 1.0.0 |
| T2.2-d | `Field` is native field, arithmetic wraps modulo the field with no overflow check; integer literal of 2^64 is valid as `Field` (used as `global TWO_POW_64: Field`) | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/fields.md` | Noir 1.0.0 |
| T2.2-e | U1 outcome. Experiment: numeric-generic `halve<let IN: u32, let OUT: u32>` with `std::static_assert(IN == 2 * OUT, "...")` works in 1.0.0. The result type is fixed by the `let` annotation (`[Field; N / 2]`, `[Field; N / 4]`, ... `[Field; 1]`), so inference of `IN` and `OUT` works and the six `halve_*` fallback helpers are not needed. Arithmetic on the global `N` in a type position (`N / 2`) compiles. `use crate::N;` of a private root global works from a child module. A deliberate misuse `let x: [Field; 3] = halve([0; 4])` in a scratch test fails with `error: HALVE INPUT LENGTH IS NOT TWICE OUTPUT LENGTH`, so the assert fires on a compile-time use. A never-called generic function is only type-checked. Scratch `nargo test` of `node_hash`, `leaf_hash` and `compute_root` matched all six provisional vectors from design Q1 (`PAD_LEAF`, `LEAF_A`, `LEAF_B`, `NODE_A`, `NODE_SMALL`, `EMPTY_ROOT`) and two position tests passed | scratch package copy under `/tmp` (deleted afterwards), `nargo test` | nargo 1.0.0, 2026-11-20 |
| T2.3-a | Array mutation and loops: `let mut a = [x; N];` then `a[i] = v;` with a `u32` index, `for i in 0..N` with constant bounds, copy-on-assign of arrays (`let mut out = postings; out[i] = ...` leaves `postings` unchanged); used by `base_postings`, `root_of`, `with_slot` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/arrays.md`, `docs/docs/language/control_flow.md`; Context7 `/noir-lang/noir` (master) | Noir 1.0.0 |
| T2.3-b | Struct construction with `Field: value` pairs in any order and field-name shorthand (`side,`); the 1.0.0 docs show no struct-update (`..base`) syntax, so none is used and `Posting` is built with all six fields | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/structs.md` | Noir 1.0.0 |
| T2.3-c | `as` casts: `u8 as Field` (struct docs, `eyes as Field`), `Field as u32` (arrays docs, `x as u32`), `AsPrimitive<T>` is "equivalent to using the `as` keyword" with impls between `u8`, `u32`, `u64`, `Field`; used here: `u32 as Field` and `u32 as u64` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/structs.md`, `arrays.md`; Context7 `/noir-lang/noir` (`AsPrimitive`, master) | Noir 1.0.0 |
| T2.3-d | Comparison and `if` expressions: `if cond { a } else { b }` yields a value; `==`, `<` and `%` on `u32`; `if` inside a constrained `for` loop body is allowed | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/control_flow.md`; confirmed by compile of `test_support.nr` | Noir 1.0.0 |
| T2.3-e | Test-only marking: no `#[test_only]` attribute exists. `docs/docs/language/attributes.md` lists `allow(dead_code)`, `allow(unused_mut)`, `allow(unused_variables)`, `builtin`, `deprecated`, `field`, `fuzz`, `oracle`, `fold`, `inline_always`, `inline_never`, `no_predicates`, `export`, `must_use`, `abi`, `contract_library_method`, `varargs`, `derive`, `test`; `compiler/noirc_frontend/src/parser/parser/attributes.rs` has no `test_only` arm (only `test(only_fail_with = ...)`, which is a `#[test]` scope). Helpers therefore live in a normal module and carry `#[allow(dead_code)]` (applies to "a data type or function") | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/attributes.md`, `compiler/noirc_frontend/src/parser/parser/attributes.rs` | Noir 1.0.0 |
| T2.3-f | Experiment: throwaway copy of the package with a temporary `#[test]` module (`base_postings(10)` has 10 non-padding slots, record_id, account and salt follow the formulas, debit sum equals credit sum 500010, slot 0 debit and slot 1 credit with equal amounts, slot 10 and 63 padding; `with_slot` changes only slot 3; `root_of` is deterministic and differs after `with_slot`; `base_postings(64)` slot 63 is a credit of 100031). `nargo test`: 3 passed. Scratch deleted | scratch copy under `~/.cache` (deleted afterwards), `nargo test` | nargo 1.0.0, 2026-11-20 |
| T2.4-a | Test attribute syntax: `#[test]`, `#[test(should_fail)]`, `#[test(should_fail_with = "<reason>")]`. A test function cannot take arguments in this form (a `#[test]` with arguments is a fuzz test). The docs say the string only needs to be a substring of the failure reason | `noir-lang/noir` tag `v1.0.0`: `docs/docs/tooling/tests.md` | Noir 1.0.0 |
| T2.4-b | Substring matching (L10), read from source: `check_expected_failure_message` lower-cases both the expected string and the failed assertion message (or the diagnostic message if there is no assertion message) and tests `contains`. So matching is a case-insensitive substring match, which the docs do not state. The eight test messages are upper case and none contains another (56 ordered pairs checked, no containment) | `noir-lang/noir` tag `v1.0.0`: `tooling/nargo/src/ops/test.rs`, `check_expected_failure_message` | Noir 1.0.0 |
| T2.4-c | Calling `main` from a test: the docs example calls `main(65)` from a `#[test]`. Here `main` is in the crate root and the tests are in `mod tests`, so `use crate::main;` is used. Confirmed by `nargo compile` and `nargo test --list-tests` (both exit 0) with `src/tests.nr` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/tooling/tests.md`; compile of the package | Noir 1.0.0, nargo 1.0.0 |
| T2.4-d | Integer literals and `limit_cents`: an untyped literal takes its type from context, an optional suffix (`1u8`, `100_Field`) forces one, and `_` separators are ignored. The tests pass `LIMIT` (a `u64` global) or the `u64` global `TWO_POW_40 = 1099511627776` as the third argument of `main`, and `record_count` literals (`10`, `0`, `65`) are inferred as `u32` from the parameter type. No suffix is needed | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/integers.md`, section "Integer Literal Syntax"; compile of `tests.nr` | Noir 1.0.0 |
| T2.6-a | `assert(cond, "message")` in 1.0.0: the message is optional. The docs say it can be a string literal, a format string or any value printable by `print`. Source: `codegen_constrain_error` stores a literal as `ConstrainError::StaticString` and anything else (f-string, variable) as a dynamic payload with a selector. So non-literal and f-string messages are accepted by the compiler; the "literal only, no f-string" rule is this project's own rule (a static string is the form that `should_fail_with` matches by substring) | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/assert.md`, `compiler/noirc_evaluator/src/ssa/ssa_gen/mod.rs` (`codegen_constrain`, `codegen_constrain_error`) | Noir 1.0.0 |
| T2.6-b | Boolean operators: `\|\|` and `&&` do not exist ("Noir has no support for the logical operators `\|\|` and `&&`", no short-circuiting). `\|` and `&` operate on `bool` without short-circuit. The parser maps `\|` to `BinaryOpKind::Or` and `&` to `And`; a `&&` token is parsed as `And` but pushes a parser error (`ParserErrorReason::LogicalAnd`). Operators are parenthesised in the circuit, because the parser chain is `\|` (loosest), `&`, `^`, then comparison | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/ops.md`, `compiler/noirc_frontend/src/parser/parser/infix.rs` (`parse_or`, `parse_and`) | Noir 1.0.0 |
| T2.6-c | Integer comparison `<`, `<=`, `>=`, `==` on `u8`, `u32`, `u64`: allowed between two values of the same integer type ("upper bound must have a known bit size"). An untyped literal takes the other operand's type (`record_count >= 1`). Entry-point integer parameters get a range constraint with predicate one in ACIR generation (`add_numeric_input_var` calls `range_constrain_var` for every non-`Field` type), so `record_count`, `limit_cents` and each `side`, `amount` and `review_flag` are already bounded by their type before the circuit's own checks | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/ops.md`, `docs/docs/language/data_types/integers.md`, `compiler/noirc_evaluator/src/acir/mod.rs` (`add_numeric_input_var`) | Noir 1.0.0 |
| T2.6-d | `u64` addition overflow: "Computations that exceed the type boundaries will result in overflow errors" with `Assertion failed: 'attempt to add with overflow'`, a runtime failure. `wrapping_add` exists only as an explicit opt-in (`std::ops::WrappingAdd`), so plain `+=` never wraps. After constraint 6 each amount is below 2^40, so each total is below 2^46 and the overflow check cannot fire on a range-checked witness | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/integers.md`, section "Overflows" | Noir 1.0.0 |
| T2.6-e | `for` over a compile-time range with a runtime-dependent condition on the loop index: constrained loops need constant bounds (`break` and `continue` are unconstrained-only), so every `for i in 0..N` runs all N iterations. The control-flow page says the loop index is `u64`, while the integers page lists loop indices among the cases that default to `u32`. Settled by the compiler: with `N: u32` as the upper bound, `i` is `u32`, and `i < record_count`, `i >= record_count` and `postings[i]` compile. A runtime `if` with assignment inside the loop is allowed (control-flow page). The circuit writes constraints 7 and 10 as `(i < record_count) \| is_padding(p)` and `(i >= record_count) \| (amount <= limit_cents) \| (review_flag == 1)`, with no `if`, so no assertion sits under a predicate; constraint 9 uses `if side == 0 { debit_total += amount } else { credit_total += amount }` | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/control_flow.md`, `docs/docs/language/data_types/integers.md`; `nargo compile` of `main.nr` | Noir 1.0.0, nargo 1.0.0, 2026-11-20 |
| T2.6-f | Casts: no cast is needed in `main.nr`. `amount` and `limit_cents` are both `u64`, `i` and `record_count` are both `u32`, and `side` and `review_flag` are compared with the `u8` constants `SIDE_CREDIT`, `SIDE_DEBIT` and `FLAG_SET`. The only casts are `u8 as Field` and `u64 as Field` in `leaf_fields` (T2.3-c). No `u32 as u64` appears | `noir-lang/noir` tag `v1.0.0`: `docs/docs/language/data_types/structs.md`, `arrays.md`; `posting.nr` | Noir 1.0.0 |
| T2.6-g | U1 outcome for task 2.6: `assert` with a literal message, `\|` and `&` on `bool`, `<`, `<=`, `>=` on `u8`, `u32` and `u64`, `+=` on `u64` inside an `if` in a `for` loop, and the numeric-generic `compute_root` called from `main` all compile with `nargo compile` (exit 0, no error, no warning). No fallback was needed | `nargo compile` on `circuits/ledger_audit` | nargo 1.0.0, 2026-11-20 |
| T2.7-a | U2 outcome: `should_fail_with` matches each assertion message; four swapped pairs all fail | nargo test experiment, nargo 1.0.0 | 1.0.0 |
| T2.8-a | Hex literal syntax for `Field` constants: the lexer (`eat_digits`) accepts a `0x` prefix (lower case only; the prefix test is `strip_prefix("0x")`), parses the rest with `BigInt::from_str_radix(.., 16)`, ignores `_` separators, and the lexer unit test lists `0x05`, `0x1234_5678` and `0x_01` as valid. The `integers.md` and `fields.md` pages of the tagged docs do not mention hex literals, and Context7 `/noir-lang/noir` (master) returned only hex formatting of `Field` in `println`, nothing on literal syntax, so the lexer source is the evidence. Used as `global NAME: Field = 0x...;` | `noir-lang/noir` tag `v1.0.0`: `compiler/noirc_frontend/src/lexer/lexer.rs` (`eat_digits`, test `test_eat_integer_literals`); `docs/docs/language/data_types/{integers,fields}.md`; Context7 `/noir-lang/noir` | Noir 1.0.0 |
| T2.8-b | Leading zeros in a hex literal: accepted, because the digits go straight to `from_str_radix`, which ignores leading zeros (the lexer test has `0x05`). `LEAF_B` is written as `0x00a9e776…b1e8` (64 hex digits, leading byte `00`) and compiles and matches | lexer source as in T2.8-a; `nargo test` of `leaf_hash_matches_bb_js` | Noir 1.0.0, nargo 1.0.0, 2026-11-20 |
| T2.8-c | Maximum literal value: the lexer rejects a literal greater than `max_integer`, which is set to `FieldElement::modulus()` (the BN254 scalar field modulus), with `IntegerLiteralTooLarge`. The check is `bigint > max_integer`, so the modulus itself passes the lexer. All six vectors are below the modulus (largest leading digits `0x2f83…`, modulus starts `0x3064…`), so none is reduced | `noir-lang/noir` tag `v1.0.0`: `compiler/noirc_frontend/src/lexer/lexer.rs` (`Lexer::new`, `eat_digits`) | Noir 1.0.0 |
| T2.8-d | Experiment: three message swaps for the new `_fails` tests. In each pair both tests FAIL (18 passed, 2 failed): `side_value_2_fails` with `amount_at_2_pow_40_fails`, `review_flag_value_2_fails` with `limit_at_2_pow_40_fails`, `padding_nonzero_salt_fails` with `wrong_root_fails`. `tests.nr` restored and checked by sha256 | `nargo test` with a temporary edit of `tests.nr` (restored) | nargo 1.0.0, 2026-11-20 |
| T2.10-a | bb.js `poseidon2Hash` API for the throwaway all-padding level run: `Barretenberg.new(options)` (async), `poseidon2Hash({ inputs: Uint8Array[] }): Promise<{ hash: Uint8Array }>` with 32-byte big-endian field elements, `destroy(): Promise<void>`. `BackendOptions` has `threads`, `backend` (`BackendType.Wasm` is direct WASM, no worker) and `skipSrsInit`. The run used `{ threads: 1, backend: BackendType.Wasm, skipSrsInit: true }`, so no SRS was downloaded or loaded and no network call was made. Results: level 0 equals `PAD_LEAF`, level 6 equals `EMPTY_ROOT`, and the five intermediate levels match the design's prefixes and suffixes | `@aztec-foundation/bb.js` 6.0.0 published types: `dest/node/cbind/generated/api_types.d.ts`, `dest/node/bb_backends/index.d.ts`, `dest/node/barretenberg/index.d.ts`; throwaway script in `/tmp`, deleted | `@aztec-foundation/bb.js` 6.0.0, 2026-11-20 |
| T4.1-a | `nargo compile` options in 1.0.0 (U4): `nargo compile --help` lists `--package`, `--workspace`, `--force` ("Force a full recompilation"), `--print-acir`, `--deny-warnings`, `--silence-warnings`, `--skip-underconstrained-check`, `--skip-brillig-constraints-check` and others, and has no `--program-dir` or output-path option. `--force` is declared as `#[arg(long = "force")] force_compile` in `CompileOptions`. The script passes `--force` only | `nargo compile --help` on the installed binary; `noir-lang/noir` tag `v1.0.0`: `compiler/noirc_driver/src/lib.rs` (`CompileOptions`) | nargo 1.0.0, 2026-11-20 |
| T4.1-b | `nargo compile` output location (U4): `compile_cmd.rs` calls `save_program_to_file(&program.into(), &package.name, &workspace.target_directory_path())`. `save_build_artifact_to_file` writes `output_dir.join(<package name>).with_extension("json")` (creating the directory if needed), and `target_directory_path()` is `target_dir` if set, else `<workspace root>/target`. So the artifact is `<package root>/target/ledger_audit.json`, i.e. `circuits/ledger_audit/target/ledger_audit.json`. The nargo-written file has top-level keys `artifact_version`, `noir_version`, `hash`, `abi`, `bytecode`, `debug_symbols`, `file_map`, with `bytecode` a string and `abi` an object (read-only look at the existing git-ignored file from the earlier compile; nothing was compiled in this task). The script requires `bytecode` (non-empty string) and `abi` (object) | `noir-lang/noir` tag `v1.0.0`: `tooling/nargo_cli/src/cli/compile_cmd.rs`, `tooling/artifact_cli/src/fs/artifact.rs` (`save_program_to_file`, `save_build_artifact_to_file`), `tooling/nargo/src/workspace.rs` (`target_directory_path`, `package_build_path`) | Noir 1.0.0, 2026-11-20 |
| T4.1-c | `child_process.spawnSync(command[, args][, options])`: options `cwd` (string or URL), `encoding` (default `'buffer'`; `'utf8'` returns strings), `maxBuffer` (default 1 MiB, child is terminated and output truncated if exceeded; the script sets 64 MiB), `shell` (default false, so no shell is used and no argument is interpreted); return object has `pid`, `output`, `stdout`, `stderr`, `status` (number, or null if killed by a signal), `signal`, `error` (set if the child failed to spawn or timed out). Checked on Node v24.14.1 with a scratch one-liner outside the repo: a missing binary gives `status null`, `signal null`, `error.code 'ENOENT'`, `stdout`/`stderr` undefined; `sh -c 'echo out; echo err >&2; exit 3'` with `cwd` and `encoding: 'utf8'` gives `status 3` and string `stdout`/`stderr`. The script checks `error` first, then `signal`, then `status !== 0` | Node 24 docs `https://nodejs.org/docs/latest-v24.x/api/child_process.html` (`child_process.spawnSync`); `node -e` run in `/tmp` | Node v24.14.1, 2026-11-20 |
| T4.1-d | `fs.renameSync(oldPath, newPath)` returns `undefined` and follows POSIX `rename(2)` (atomic replace of an existing target on the same file system, which is why the temp files sit in `src/zk/artifacts/`); throws on failure. `fs.writeFileSync(file, data[, options])` accepts a string, `Buffer`, `TypedArray` or `DataView`, `flag` default `'w'`, `mode` default `0o666`, throws on failure, so passing the `Buffer` that was hashed writes exactly those bytes. `fs.rmSync(path, { force: true })` is used for cleanup and ignores a missing path | Node 24 docs `https://nodejs.org/docs/latest-v24.x/api/fs.html` (`fs.renameSync`, `fs.writeFileSync`) | Node v24.14.1, 2026-11-20 |
| T4.1-e | `crypto.createHash(algorithm)` returns a `Hash`; `hash.update(<Buffer>)` hashes the bytes unchanged (strings would be UTF-8 encoded, so a `Buffer` is passed); `hash.digest('hex')` returns lower-case hexadecimal, 64 characters for `'sha256'` | Node 24 docs `https://nodejs.org/docs/latest-v24.x/api/crypto.html` (`crypto.createHash`) | Node v24.14.1, 2026-11-20 |
| T4.1-f | An extensionless file with `import` statements under `"type": "module"`: `node --check scripts/build-circuit` exits 0, `node --check --input-type=module < scripts/build-circuit` exits 0, and in a scratch directory outside the repo (`/tmp`, a `package.json` with `{"type":"module"}`, an extensionless `tool` file with `#!/usr/bin/env node` and `import`) `node tool` ran and printed `import.meta.url` as a string, so Node 24.14.1 treats the extensionless file as ESM as the design (Q8) says. The scratch directory was deleted | `node --check`, scratch run in `/tmp` | Node v24.14.1, 2026-11-20 |
| T4.2-a | `nargo compile` output path (U4), confirmed by the first run of the Build_Script: `circuits/ledger_audit/target/ledger_audit.json`. Evidence: the script reads exactly that path after `nargo compile --force` and exited 0 (it exits 1 at step `artifact missing` if the file is absent); `cmp src/zk/artifacts/ledger_audit.json circuits/ledger_audit/target/ledger_audit.json` exited 0 (identical bytes), so the Artifact is the file `nargo compile` wrote. Matches the source reading in T4.1-b | `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit` (exit 0), `cmp` | nargo 1.0.0, 2026-11-20 |
| T4.2-b | First Build_Script run, result. Artifact `src/zk/artifacts/ledger_audit.json`: 117095 bytes, sha256 `9c28a04d3a66b9b9aed435266746e6e0344d3d8700fcd9d92afe55a3cddcd5c6` (equals `shasum -a 256`). Meta `src/zk/artifacts/ledger_audit.meta.json` (134 bytes, two-space indent, trailing newline, keys in this order): `{"nargoVersion": "nargo version = 1.0.0", "artifactSha256": "9c28a04d3a66b9b9aed435266746e6e0344d3d8700fcd9d92afe55a3cddcd5c6"}`. Artifact top-level keys: `artifact_version`, `noir_version` (`1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c`), `hash`, `abi`, `bytecode`, `debug_symbols`, `file_map`; `bytecode` is a string (53368 characters), `abi` is an object. `/Users/` finding: the artifact CONTAINS the absolute path of this machine. `file_map` has 5 entries; four hold `/Users/lavopavden/Dev/projects/CryptTerm/circuits/ledger_audit/src/{hash,main,merkle,posting}.nr` and one holds the relative `std/hash/mod.nr`. The artifact was not edited. Consequences to decide before 4.3 and 4.6: the committed file exposes the local user name and project path, and a build on another machine or in another directory yields different bytes and a different sha256, so the sha256 is reproducible only from this checkout path. No `.tmp-*` file was left in `src/zk/artifacts/`; `git check-ignore -v` on both files exits 1 (not ignored) | `node` JSON inspection, `grep -c '/Users/'`, `shasum -a 256`, `xxd`, `git check-ignore -v` | nargo 1.0.0, 2026-11-20 |
| T4.3-a | Build_Script idempotence and cross-checkout determinism (U5, Requirement 7.5), sha256 of Artifact `ledger_audit.json` / Artifact_Meta `ledger_audit.meta.json`. Baseline (task 4.2, checkout `/Users/lavopavden/Dev/projects/CryptTerm`): `9c28a04d3a66b9b9aed435266746e6e0344d3d8700fcd9d92afe55a3cddcd5c6` / `4a7c7ae6461b44472e0a25265e992eeeb3249f7d4233007664190464435fdeae`. Run 2 (same checkout, `npm run build:circuit` again): `9c28a04d…cd5c6` / `4a7c7ae6…fdeae`, `cmp` against a saved copy of the baseline exits 0 for both files: IDENTICAL. Run 3 (copy of `circuits/`, `scripts/`, `src/zk/artifacts/` without `target/`, plus `package.json` `{"type": "module"}`, in a temp directory `checkout-b` outside the repo, fresh compile): 117083 bytes, `5262358ea729ead4c9f91b98c9f97cfea299a3e1e0dda3d793277885badd6910` / `fca3d396ef0dade309c988bf4c58c3dda03634572e68357d2703eabd31d4e479`: DIFFERS from baseline. Run 4 (same procedure, second temp directory `checkout-c`): 117083 bytes, `d36ed024ef8663a9ff1e3c5f6b1334a0a5dad493a8bed9b516c8afddc9896780` / `07f735000e8bfa1e66aec1f1235926f1c78c4bb79fbc6c84d06f77b2d1325662`: DIFFERS from baseline and from run 3 (only the path differs). Verdict: same checkout is idempotent; different checkout path is NOT deterministic. Done-when of task 4.3 does NOT hold. STOP: the fallback is huynh's decision. The repo files were not changed (sha256 equal to the baseline after all runs) | `shasum -a 256`, `cmp`, `npm run build:circuit`, `node scripts/build-circuit` in two temp directories (deleted afterwards) | nargo 1.0.0, 2026-11-20 |
| T4.3-b | Cause of the difference (JSON-aware comparison of baseline, run 3, run 4). Top-level keys `artifact_version` (1), `noir_version` (`1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c`), `hash` (`615334819401416314`), `abi`, `bytecode` and `debug_symbols` are byte-identical in all three artifacts; Meta `nargoVersion` is `nargo version = 1.0.0` in all. Only `file_map` differs: the `path` field of four entries (ids 53 to 56: `hash.nr`, `main.nr`, `merkle.nr`, `posting.nr`) holds the absolute directory of the checkout (`/Users/lavopavden/Dev/projects/CryptTerm/circuits/ledger_audit/src/…` in the baseline, `/private/tmp/<dir>/checkout-b/circuits/…` and `…/checkout-c/…` in runs 3 and 4; `/tmp` resolves to `/private/tmp` on macOS). Entry 17 (`std/hash/mod.nr`) is relative and identical. The `source` text of all five entries is identical. After replacing the four `path` values with a placeholder the three artifacts are identical. The difference in size (117095 vs 117083 bytes) is the path length. `debug_symbols` is a base64 and raw-deflate blob; its decompressed content refers to files by numeric id (the `file` field of a location node, read from noir_js `debug.mjs`), and the compressed string is identical in all runs, so it embeds file ids and no path. Conclusion: the circuit (`bytecode`, `abi`, `hash`) is deterministic across checkouts; only the debug data in `file_map` embeds the checkout path. noir_js 1.0.0 use: `CompiledCircuit` (`@noir-lang/types`) declares `debug_symbols: string` and `file_map: DebugFileMap` as required fields. In `witness_generation.mjs`, `generateWitness` needs only `abi` (`abiEncode`) and `bytecode` (`executeProgram`). `debug_symbols` and `file_map` are read only in `enrichExecutionError`, inside a `try` whose `catch` ignores any error, to set `noirCallStack` (strings `at <locationText> (<filePath>:<line>:<column>)`, so the absolute path of the build machine would appear there). The assertion message (`Circuit execution failed: <message>`) comes from `abi` and `rawAssertionPayload`, not from the debug data. `@aztec-foundation/bb.js` 6.0.0 `dest/` has no reference to `file_map` or `debug_symbols`. Not decided: whether to strip, keep or normalise them (huynh) | `node` JSON comparison script in `/tmp` (deleted), `node_modules/@noir-lang/noir_js/lib/{witness_generation,debug,program}.mjs`, `node_modules/@noir-lang/types/lib/esm/types.d.ts`, `grep` in `node_modules/@aztec-foundation/bb.js/dest` | noir_js 1.0.0, @noir-lang/types 1.0.0, bb.js 6.0.0, 2026-11-20 |
| T4.1-g | `fs.realpathSync(path[, options])` returns the resolved pathname as a string (symlinks resolved, `encoding` default `'utf8'`), and throws if the path does not exist. The script calls it on the package directory in addition to `path.resolve`, because the two can differ. Evidence on this machine (macOS, scratch directory made with `mktemp -d /tmp/...`): `/tmp/ct-scratch.X` resolves to `/private/tmp/ct-scratch.X`. Node itself resolves symlinks of the main module (`import.meta.url` is the real path unless `--preserve-symlinks-main` is given), so `path.resolve(circuitDir)` and `realpathSync(circuitDir)` are equal in a default run; they differ only when the script is started with `--preserve-symlinks-main` through a symlinked path | Node 24 docs `https://nodejs.org/docs/latest-v24.x/api/fs.html` (`fs.realpathSync`); scratch runs in `/tmp` | Node v24.14.1, 2026-11-20 |
| T4.1-h | `os.homedir()` returns the current user's home directory as a string. On POSIX it uses the `$HOME` environment variable if defined, otherwise the effective UID lookup; on Windows it uses `USERPROFILE` if defined. Checked: `HOME=/tmp/fakehome node -e ...` prints `/tmp/fakehome`. The script checks the rewritten text for this value (plain, JSON-escaped, forward-slash form, and its `realpathSync` form), so a changed `$HOME` changes what is checked and the check is only as good as `$HOME` | Node 24 docs `https://nodejs.org/docs/latest-v24.x/api/os.html` (`os.homedir`); scratch run | Node v24.14.1, 2026-11-20 |
| T4.1-i | `String.prototype.replaceAll(pattern, replacement)` with a string pattern: the pattern is literal (no regular expression, `"a.b.c".replaceAll(".", "")` gives `abc`), every non-overlapping match is replaced from left to right (`"aaa".replaceAll("aa", "X")` gives `Xa`). Special replacement patterns (`$&`, `$$`) apply only to a non-empty replacement string (`"abc".replaceAll("b", "[$&]")` gives `a[b]c`); the script replaces with the empty string, so they do not matter. Prefix order matters: with `/tmp/x/` and `/private/tmp/x/` in one text, replacing `/tmp/x/` first leaves `/private` behind (`a/privateb c`), longest first gives `ab c`; the script sorts the prefix set by length, longest first | Scratch run in `/tmp`; MDN `String.prototype.replaceAll` | Node v24.14.1, 2026-11-20 |
| T4.1-j | Task 4.1 amendment (U5, decision A), scratch results in `/tmp/ct-scratch.qbGDKO` (copy of `circuits/` and `scripts/`, `{"type":"module"}` package.json, deleted afterwards; the repo `src/zk/artifacts/` was not touched). Which form nargo writes: the REAL path, not the path as given. The scratch directory was `/tmp/ct-scratch.qbGDKO` (symlink target `/private/tmp/...`), and `nargo compile --force` run by the script with `cwd` set to that directory wrote `/private/tmp/ct-scratch.qbGDKO/circuits/ledger_audit/src/{hash,main,merkle,posting}.nr` in `file_map[*].path`; entry `std/hash/mod.nr` is relative. Run 1 (default `node scripts/build-circuit`, real nargo, exit 0): prefix `/private/tmp/ct-scratch.qbGDKO/circuits/ledger_audit/` (53 characters) found 4 times, 4 x 53 = 212 bytes removed, 117055 bytes became 116843 bytes (delta 212 equals the removed prefix bytes), sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`. Run 2 (`node --preserve-symlinks-main --preserve-symlinks` through the `/tmp/...` path): same output bytes, `cmp` exit 0 against run 1. Rewritten `file_map` paths: `posting::Posting`, `std/hash/mod.nr`, `src/hash.nr`, `src/main.nr`, `src/merkle.nr`, `src/posting.nr`. `grep -c` on the rewritten file for `/Users/`, `$HOME`, `/private/` and the scratch directory name: 0, 0, 0, 0. Removing the 4 prefixes textually from the compile output gives exactly the rewritten text (`o.split(prefix).join('') === r`), and the last 6 bytes (`"}]}}}`, no trailing newline) are identical. Raw text equal between compile output and rewritten file: `"hash":"615334819401416314"`, the `"bytecode":"..."` value (53381 characters with key and quotes), the `"abi":{...}` object (1711 characters) and `debug_symbols` (16562 characters). Correction to the brief: in nargo 1.0.0 `hash` is a decimal STRING in the JSON, not a bare integer; the textual approach is unchanged. Meta `ledger_audit.meta.json` is 134 bytes with the sha256 of the rewritten file. The expected result for the repo checkout: prefix `/Users/lavopavden/Dev/projects/CryptTerm/circuits/ledger_audit/` is 63 characters, 117095 - 4 x 63 = 116843 bytes, the same size as the scratch result | `node scripts/build-circuit` in the scratch copy, `grep`, `cmp`, `shasum -a 256`, scratch comparison script | nargo 1.0.0, Node v24.14.1, 2026-11-20 |
| T4.1-k | Task 4.1 amendment, failure tests (scratch copy, crafted `target/ledger_audit.json` through a scratch `nargo` shim that is only on `PATH` inside each test command). Each case: exit status 1, stderr `build-circuit: step path rewrite failed: ...`, `src/zk/artifacts/` unchanged (listing and sha256 of both files before and after), no `.tmp-*` file left. (a) repo root outside the package (`<root>/other/x.nr`): `rewritten artifact still contains the repo root path ...`. (a) home directory (`$HOME/.nargo/x.nr`): `... still contains the home directory path ...`. (b) text that is valid before and invalid after the rewrite (`"\<prefix>"`, where `\/` is a valid escape and removing the prefix leaves `"\"`): `rewritten artifact is not valid JSON`. (d) prefix inside the `bytecode` string: `bytecode` differs between the compile output and the rewritten artifact. (d) prefix inside an `abi` name: `abi` differs (same wording). A duplicate top-level key (valid for `JSON.parse`): `cannot extract raw values: duplicate top-level key`. (c) cannot be produced through an input file, because removing a path prefix from text cannot delete a key or change its type; it was exercised with a mutated scratch copy of the script (the replacement also renames `"abi":` to `"abx":`): `rewritten artifact has no abi object`. The size check was exercised the same way (replacement by spaces of equal length, so nothing is removed): `rewritten artifact is 117055 bytes, expected 116843 (removed 212)`. `nargo` absent from `PATH`: `step version failed: nargo not found on PATH (nargo --version)`, exit 1, artifacts unchanged. Known limits found: (1) a path outside the package that is neither under the repo root nor under the home directory (for example `/Users/someone/else/file.nr`) is not covered by the conditions and the script accepts it (exit 0, the path stays in the output); (2) if nargo wrote the path as given through a symlink (`/tmp/...`) while Node started the script from the resolved path (`/private/tmp/...`, the default), neither form is known to the script and the text is left unchanged and not detected; observed nargo output is always the real path (T4.1-j), and the symlink-preserving start handles both forms; (3) Windows forms (`C:\\Users\\...\\` JSON-escaped, `C:/Users/.../`) are produced by `pathForms` when `path.sep` is `\`, but were not run on Windows | Scratch runs, shim, mutated script copies | nargo 1.0.0 (real) / shim, Node v24.14.1, 2026-11-20 |
| T4.2-c | Re-run of task 4.2 after the task 4.1 amendment (the Build_Script now rewrites the absolute source paths). The first (path-containing) artifact (T4.2-b: 117095 bytes, sha256 `9c28a04d3a66b9b9aed435266746e6e0344d3d8700fcd9d92afe55a3cddcd5c6`, Meta sha256 `4a7c7ae6461b44472e0a25265e992eeeb3249f7d4233007664190464435fdeae`) was replaced by this run and was never committed. Command `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit`, exit status 0, stdout `build-circuit: wrote src/zk/artifacts/ledger_audit.json (116843 bytes, sha256 2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b)`. Rewritten Artifact `src/zk/artifacts/ledger_audit.json`: 116843 bytes, sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b` (equals `shasum -a 256`). Size: 117095 - 116843 = 252 bytes = 4 occurrences x 63 bytes of the prefix `/Users/lavopavden/Dev/projects/CryptTerm/circuits/ledger_audit/`. Meta `src/zk/artifacts/ledger_audit.meta.json` (`cat -v`, two-space indent, trailing newline `0a`, keys in this order): `{"nargoVersion": "nargo version = 1.0.0", "artifactSha256": "2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b"}`; `nargoVersion` equals `nargo version = 1.0.0` exactly, `artifactSha256` is 64 lowercase hex and equals the recomputed sha256, and the Meta bytes equal `JSON.stringify(meta, null, 2) + "\n"`. No `.tmp-*` file left in `src/zk/artifacts/`. `nargo compile` output path (U4) is unchanged from T4.2-a (`circuits/ledger_audit/target/ledger_audit.json`, 117095 bytes). Artifact top-level keys: `artifact_version`, `noir_version` (`1.0.0+275d3ab1a5c916c6ea73e8d6b943f685f574500c`), `hash`, `abi`, `bytecode`, `debug_symbols`, `file_map` | `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit` (exit 0), `shasum -a 256`, `cat -v`, `xxd`, `wc -c`, `node` (reading only) | nargo 1.0.0, 2026-11-20 |
| T4.2-d | Checks of the rewritten Artifact (task 4.2 re-run). `grep -c` on `src/zk/artifacts/ledger_audit.json`: `/Users/` 0, `$HOME` (`/Users/lavopavden`) 0, `/private/` 0, `/home/` 0 (each `grep -c` exit status 1, the expected outcome for a count of 0). `file_map` paths, exactly: `src/hash.nr`, `src/main.nr`, `src/merkle.nr`, `src/posting.nr`, `std/hash/mod.nr`. Rewrite equivalence: `circuits/ledger_audit/target/ledger_audit.json` with the prefix `/Users/lavopavden/Dev/projects/CryptTerm/circuits/ledger_audit/` (4 occurrences) removed through `replaceAll` in a node one-liner equals the rewritten Artifact byte for byte (`cmp` exit 0). `cmp` of the Artifact against `target/ledger_audit.json` exits 1 (first difference at char 110690, inside the rewritten paths), as expected. Raw top-level values (extracted without parsing) of `bytecode` (53370 characters with quotes), `abi` (1711), `hash` (`"615334819401416314"`, 20) and `debug_symbols` (16546) are identical between `target/ledger_audit.json` and the Artifact. `git check-ignore -v` on both files prints nothing (exit 1, not ignored) | `grep -c`, `node` (`replaceAll`, raw value extraction), `cmp`, `git check-ignore -v` | nargo 1.0.0, 2026-11-20 |
| T4.3-c | Re-run of task 4.3 after huynh's decision A (path rewrite in the Build_Script). sha256 of Artifact `ledger_audit.json` (116843 bytes) / Artifact_Meta `ledger_audit.meta.json` (134 bytes). Baseline (task 4.2 re-run, repo checkout; copies saved outside the repo): `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b` / `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`. Run 2 (same checkout, `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit`, exit 0): `2b08fea5…eecd5b` / `d62b899b…c334e01`, `cmp` against the saved baseline copies exits 0 for both: IDENTICAL. Run 3 (other directory #1, `<home>/ct-checkout-b`, real path equal to the given path, depth 1 under the home directory; copy of `circuits/` without `target/`, `scripts/`, `src/zk/artifacts/`, plus `package.json` `{"type": "module"}`; fresh compile, `node scripts/build-circuit`, exit 0): 116843 bytes, `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b` / `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`, `cmp` against the baseline copies exits 0 for both: IDENTICAL. Run 4 (other directory #2, `/private/tmp/<name with space and dot>/<name with space>/<name with dot>` (for example `ct run.x/nested dir/checkout.c`), the REAL macOS path written out in full instead of the `/tmp` symlink, depth 3 under `/private/tmp`; same procedure, exit 0): 116843 bytes, same sha256 values for both files as the baseline, `cmp` exit 0 for both: IDENTICAL. The spaces did not break the run. The raw `target/ledger_audit.json` of the two fresh compiles differed (117059 bytes in run 3, 117107 bytes in run 4, because of the path length), the rewritten Artifacts are equal. Table: baseline / run 2 / run 3 / run 4 Artifact = `2b08fea5…eecd5b` in all four; Meta = `d62b899b…c334e01` in all four. Verdict: identical in all runs. The done-when of task 4.3 holds (repo, other directory #1, other directory #2: same Artifact sha256, same Meta sha256). U5 is resolved by the path rewrite | `shasum -a 256`, `cmp`, `npm run build:circuit`, `node scripts/build-circuit` in two directories outside the repo (deleted afterwards) | nargo 1.0.0, Node v24.14.1, 2026-11-20 |
| T4.3-d | Checks after the T4.3-c runs. `grep -c` on the Artifact for `/Users/`, `/private/`, `/var/`, `/tmp/`: 0, 0, 0, 0 in the repo file and in the files from both other directories (12 counts, all 0). No `.tmp-*` file left in the repo (`src/zk/artifacts/` lists exactly `ledger_audit.json` and `ledger_audit.meta.json`) or in either other directory. After all runs the repo files are byte-identical to the baseline (`cmp` exit 0, sha256 as in T4.3-c). All temporary directories (the saved baseline copies and both other directories) were deleted | `grep -c`, `find`, `cmp`, `shasum -a 256` | nargo 1.0.0, 2026-11-20 |
| T4.4-a | Task 4.4 review of `scripts/build-circuit` against Requirement 7.4 (and the 7.2 path-rewrite sentence), plus manual run 1 with `nargo` absent from `PATH`. Review (line numbers of the script; every failure goes through the single catch at lines 405-412, which prints `build-circuit: step <name> failed: <reason>` to stderr and sets `process.exitCode = 1`; stdout stays empty). (a) `nargo` missing: `runNargo` lines 50-62 maps `ENOENT` to a `version` StepError (step 1 at lines 310-317); exit 1, stderr names `version`; nothing is written before line 368, so Artifact and Meta are untouched and no `.tmp-*` exists. (b) `nargo compile` non-zero: lines 67-73, step `compile` (line 319-320), message carries the exit status and the tail of stderr; same effects as (a); a signal kill is also a `compile` failure (lines 64-66). (c) compiled JSON missing: lines 323-330, step `artifact missing`; same effects. (d) compiled JSON invalid: lines 331-347, step `artifact invalid` for not JSON, not an object, no `bytecode` string, no `abi` object and non-UTF-8 bytes (lines 350-354); same effects. (e) path rewrite check failed: `rewritePaths` (lines 216-285) runs at lines 356-357 and throws step `path rewrite` for a leftover repo-root or home path, a size mismatch, invalid JSON, missing bytecode or abi, or a bytecode, abi or hash difference; same effects (failure cases already exercised in T4.1-k). (f) failing write or rename (lines 368-394): the temp files are written first (lines 373-374), so a failed `mkdirSync`, `writeFileSync` or first `renameSync` (line 375) leaves both targets untouched (rename is atomic); the second rename (line 377) failing triggers the restore at lines 379-394: the old Artifact bytes were read into memory before any write (line 372), and are written back through a temp file and renamed (lines 384-385), or the new first file is removed when there was no old Artifact (line 382); the Meta needs no restore because a failed rename leaves it as it was. This restore path was read, not executed. If the restore itself fails, the thrown step `write` message names both errors (lines 389-391) and byte-identity is not guaranteed. The `finally` block (lines 399-402) removes both `.tmp-<pid>` files of this run with `rmSync(force)` in every case, including after a successful rename of the first temp file (nothing remains at that name). All six cases exit 1 with a step name on stderr. OBSERVATIONS (script not changed): (1) a `.tmp-<pid>` file left by a killed run (SIGKILL, power loss) is never removed by a later run, because the suffix uses the pid; (2) a kill between the two renames (lines 375 and 377) leaves the new Artifact with the old Meta, and no code path repairs that, only the Requirement 7.8 sha256 test would notice; (3) the restore path (lines 379-394) has no test; (4) `target/ledger_audit.json` is not deleted before `nargo compile`, so a stale file from an earlier run would be read as fresh if nargo exited 0 without writing it (case (c) therefore needs a first run on a clean checkout to trigger); (5) line 360 sets `currentStep = 'artifact invalid'` for the sha256 and Meta serialisation, so an unexpected error there is labelled `artifact invalid`, and any unexpected non-StepError error (for example EACCES from `readIfExists`, line 294) is labelled with the value of `currentStep`; (6) the step names are `version`, `compile`, `artifact missing`, `artifact invalid`, `path rewrite`, `write`, so a missing `nargo` is reported as step `version`, not as a separate name. Manual run 1 (`env -i PATH=/usr/local/bin:/usr/bin:/bin`, `node` at `/usr/local/bin/node`; `command -v nargo` printed nothing, exit 1; run from the repo root): exit status 1, stdout empty, stderr exactly `build-circuit: step version failed: \`nargo\` not found on PATH (nargo --version)`. sha256 before and after, identical: `ledger_audit.json` `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`, `ledger_audit.meta.json` `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`. `src/zk/artifacts/` listed before and after: exactly those two files (116843 and 134 bytes), no `.tmp-*`. No automated test is added (deferred to zk-core) | `scripts/build-circuit` read in full, `env -i`, `command -v`, `shasum -a 256`, `ls -la` | nargo 1.0.0 (absent in this run), node at `/usr/local/bin/node`, 2026-11-20 |
| T4.4-b | Task 4.4 manual run 2, failing compile. A scratch `nargo` shim in a `mktemp -d` directory under `/tmp`, outside the repo (`--version` printed `nargo version = 1.0.0`, `compile` wrote one line to stderr and exited 3), run with `env -i PATH=<shim dir>:/usr/local/bin:/usr/bin:/bin node scripts/build-circuit` from the repo root. Result: exit status 1, stdout empty, stderr `build-circuit: step compile failed: nargo compile --force exited with status 3: shim: compile refused`. sha256 before and after, identical: `ledger_audit.json` `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`, `ledger_audit.meta.json` `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`. `src/zk/artifacts/` lists exactly the two files, `find src/zk/artifacts -name '*.tmp-*'` prints nothing. The shim directory and the shim were deleted afterwards (`ls -d /tmp/ct44*` reports no such file) and were never on the PATH of any other command. The repo script, circuit and artifacts were not modified | `mktemp -d`, `env -i`, `shasum -a 256`, `find` | nargo 1.0.0 (shim, not the real binary), 2026-11-20 |
| T5.1-a | `circuitStats` (task 5.1, L4). Async API `Barretenberg.circuitStats(command: CircuitStats): Promise<CircuitInfoResponse>`. Request `CircuitStats` = `{ circuit: CircuitInput, includeGatesPerOpcode: boolean, settings: ProofSystemSettings }`; `CircuitInput` = `{ name: string, bytecode: Uint8Array, verificationKey: Uint8Array }`; `ProofSystemSettings` = `{ ipaAccumulation: boolean, oracleHashType: string, disableZk: boolean, optimizedSolidityVerifier: boolean }`. Response `CircuitInfoResponse` = `{ numGates: number, numGatesDyadic: number, numAcirOpcodes: number, gatesPerOpcode: number[] }`. `bytecode` is the raw (gunzipped) ACIR bytes: `src/barretenberg/index.ts` `acirGetCircuitSizes` passes `bytecode` straight to `circuitStats` with an empty `verificationKey`, and `src/barretenberg/backend.ts` `acirToUint8Array` is base64 decode then `ungzip`. No SRS argument or call exists on this path | `@aztec-foundation/bb.js@6.0.0`: `dest/node/cbind/generated/api_types.d.ts` (lines 21-31, 45-49, 328-333), `async.d.ts` line 11, `src/barretenberg/index.ts` lines 119-135, `src/barretenberg/backend.ts` lines 451-455 | bb.js 6.0.0 |
| T5.1-b | `Barretenberg.new(options)`, `BackendOptions`, `BackendType`, `destroy()` (task 5.1, L1, L2). `BackendType` is an enum exported from the package entry (`Wasm`, `WasmWorker`, `NativeUnixSocket`, `NativeSharedMemory`); `Wasm` is "WASM direct execution (no worker)". With `options.backend` set there is no fallback, and `initSRSChonk` (the CRS download) runs only when `!options.skipSrsInit` and the backend is `Wasm` or `WasmWorker`, so `skipSrsInit: true` makes no CRS request. `threads` is "number of threads to run the backend worker on". `Barretenberg#destroy(): Promise<void>` calls the base class `destroy()`. The package `exports` map resolves `default` to `dest/node/index.js` (ESM); `require.resolve` with a custom `conditions` array fails in Node 24 (`conditions.has is not a function`), so the script imports the file URL directly | `@aztec-foundation/bb.js@6.0.0`: `src/bb_backends/index.ts` (`BackendType`, `BackendOptions`), `src/barretenberg/index.ts` lines 41-82 and 137-139, `package.json` `exports` | bb.js 6.0.0 |
| T5.1-c | How many SRS points the prover asks for (task 5.1, L5, supports the design formula). `UltraProver_::construct_proof` sets `key_size = prover_instance->polynomials.max_end_index()`, and for a ZK flavor sets `key_size = max(key_size, 1 << (log2(Curve::SUBGROUP_SIZE) + 1))` (comment: "SmallSubgroupIPA commits polynomials up to SUBGROUP_SIZE + 3"), then `commitment_key = CommitmentKey(key_size)`. `CommitmentKey(n)` asks the CRS factory for `round_up_to_even(n)` points. `MemBn254CrsFactory::get_crs(degree)` throws `prover trying to get too many points in MemBn254CrsFactory! <have> vs <degree>` when `get_monomial_size() < degree`. Nothing else is added to `key_size` in this function. `SUBGROUP_SIZE` is `static constexpr size_t SUBGROUP_SIZE = 256` for BN254, so the ZK floor is `1 << (8 + 1)` = 512 | `AztecProtocol/aztec-packages` tag `v6.0.0`: `barretenberg/cpp/src/barretenberg/ultra_honk/ultra_prover.cpp` lines 63-72, `commitment_schemes/commitment_key.hpp` lines 52 and 61-63, `srs/factories/mem_bn254_crs_factory.cpp` lines 62-69, `ecc/curves/bn254/bn254.hpp` line 34 | bb 6.0.0 source |
| T5.1-d | What `numGates` and `numGatesDyadic` mean, and how they differ from the prover's own dyadic size (task 5.1, L5). `_stats` builds the circuit, calls `finalize_circuit()`, then `numGates = builder.get_finalized_total_circuit_size()` and `numGatesDyadic = builder.get_circuit_subgroup_size(numGates)`. `get_finalized_total_circuit_size()` is `max(get_tables_size(), get_num_finalized_gates() + num_public_inputs())`, so lookup tables are counted by size only. `get_circuit_subgroup_size(n)` rounds `n` up to the next power of two (`n` itself if it is one), so `numGatesDyadic` is always a power of two. The prover's `ProverInstance_::compute_dyadic_size` instead uses `trace_end = TRACE_OFFSET + NUM_ZERO_ROWS + total block content` (`TRACE_OFFSET` = `NUM_DISABLED_ROWS_IN_SUMCHECK` = `NUM_MASKED_ROWS + 1` = 4, `NUM_ZERO_ROWS` = 1) and, when lookup gates exist, `max(lookup.trace_offset() + get_tables_size(), trace_end)`, then the same rounding. So the prover's size can exceed `numGatesDyadic` only when `numGates` is within about 5 rows of a power of two, or when the lookup block starts after many other rows and the tables are large. `circuitStats` does not need an SRS (the function only builds the circuit) | `aztec-packages` tag `v6.0.0`: `bbapi/bbapi_ultra_honk.cpp` lines 179-199, `stdlib_circuit_builders/ultra_circuit_builder.hpp` lines 400-423, `stdlib_circuit_builders/circuit_builder_base_impl.hpp` lines 70-77 (the declaration is in `circuit_builder_base.hpp` line 273), `ultra_honk/prover_instance.cpp` lines 47-49 and 135-151, `constants.hpp` lines 44-49 and 68 | bb 6.0.0 source |
| T5.1-e | `bb gates` CLI (task 5.1, U14). `~/.bb/bb gates --help`: "Construct a circuit from the given bytecode (in particular, expand black box functions) and return the gate count information." Options `-b,--bytecode_path` (ACIR bytecode generated by Noir), `--include_gates_per_opcode`, `-t,--verifier_target` with `noir-recursive` = "Noir circuits (poseidon2, ZK)". Run from an empty scratch directory `/tmp/t51-cwd`; it wrote no file there | `~/.bb/bb gates --help` | bb 6.0.0 |
| T5.1-f | Measurement (task 5.1, 2026-11-21). Artifact `src/zk/artifacts/ledger_audit.json` (sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`, 116843 bytes): base64 `bytecode` 53368 characters, gzip 40024 bytes, ACIR 577648 bytes. Script `/tmp/t51-stats.mjs` (outside the repo, deleted afterwards), `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })`, `circuitStats` with `PROOF_SETTINGS` (`ipaAccumulation: false`, `oracleHashType: 'poseidon2'`, `disableZk: false`, `optimizedSolidityVerifier: false`, `includeGatesPerOpcode: false`) printed `{"numGates":21212,"numGatesDyadic":32768,"numAcirOpcodes":4580}`; `gatesPerOpcode` empty (not requested); `destroy()` called. The script replaced `net.Socket.prototype.connect`, `dns.lookup` and `fetch` with recorders that throw: 0 attempts. `~/.bb/bb gates -b circuits/ledger_audit/target/ledger_audit.json -t noir-recursive` printed `{"functions": [ { "acir_opcodes": 4580, "circuit_size": 21212 } ]}` (exit 0), which equals `numAcirOpcodes` and `numGates`. The CLI does not print a dyadic size. `requiredPoints = max(32768, 512) = 32768`, `N = 32768 = 2^15` (smaller than 2^16 = 65536), g1 file `N * 64` = 2097152 bytes (2 MiB). Residual UNVERIFIED: T5.1-d, the prover's own dyadic size, is settled by the first full prove with exactly `N` points (group 7) | `node /tmp/t51-stats.mjs` from the repository root; `~/.bb/bb gates` | bb.js 6.0.0, bb 6.0.0 |
| T5.2-a | Staged download (task 5.2, 2026-11-21). Staging directory `/tmp/ct52-stage.cTeY1A` (outside the repo), script `fetch.sh` run with `bash`. Each request used `curl --fail -sS --max-filesize 3000000 -D <hdr>`; the g1 requests added `-H "Range: bytes=0-2097151"`. All four curl exits 0. Responses (HTTP/2): (1) primary `https://crs.aztec-cdn.foundation/g1.dat`: `206`, `content-range: bytes 0-2097151/6400000000`, `content-length: 2097152`, `etag: "12c497c995632581589e824133785bd9-763"`, `accept-ranges: bytes`, no `content-type` header. (2) primary `https://crs.aztec-cdn.foundation/g2.dat`: `200`, `content-length: 128`, `etag: "09238fab083a646624e425566db43314"`, `accept-ranges: bytes`, no `content-type` header. (3) mirror `https://crs.aztec-labs.com/g1.dat`: `206`, `content-range: bytes 0-2097151/6400000000`, `content-length: 2097152`, `etag: "12c497c995632581589e824133785bd9-763"`, `content-type: binary/octet-stream`, no `accept-ranges` header on the 206. (4) mirror `https://crs.aztec-labs.com/g2.dat`: `200`, `content-length: 128`, `etag: "09238fab083a646624e425566db43314"`, `content-type: binary/octet-stream`, `accept-ranges: bytes`. Both g1 requests got 206 (never 200), so the 6.4 GB file was not downloaded; the file total is 6400000000 bytes = 10^8 points x 64. The primary and the mirror report the same etag for g1 and for g2 | `curl`, `bash`, `mktemp -d` | 2026-11-21 |
| T5.2-b | Checks in the staging directory before anything was copied into the repo (task 5.2). `wc -c`: primary g1 2097152, mirror g1 2097152, primary g2 128, mirror g2 128. `shasum -a 256`: primary g1 and mirror g1 both `50d2f4e9567be2b8e382cedfd078b96a3428a94597b7e88c4116e105d578ce77`; primary g2 and mirror g2 both `01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f` (equals the expected g2 hash). `cmp` primary g1 vs mirror g1 exit 0; `cmp` primary g2 vs mirror g2 exit 0 | `wc -c`, `shasum -a 256`, `cmp` | 2026-11-21 |
| T5.2-c | Sanity checks (task 5.2, read-only). `xxd -l 64` of the staged g1: first 32 bytes are 31 zero bytes then `01` (x = 1), next 32 bytes are 31 zero bytes then `02` (y = 2), so the first point is the BN254 G1 generator (1, 2) in big-endian. `2097152 / 64` = 32768 points, no header. Local bb CRS cache `~/.bb-crs/bn254_g1.dat` exists (33554432 bytes, dated Nov 19): its first 2097152 bytes (`head -c 2097152 ... \| shasum -a 256`) have sha256 `50d2f4e9567be2b8e382cedfd078b96a3428a94597b7e88c4116e105d578ce77`, equal to the staged g1, and `head -c 2097152 ~/.bb-crs/bn254_g1.dat \| cmp - p-g1.dat` exits 0. The macOS `cmp -n 2097152 <cache> <staged>` printed `cmp: EOF on p-g1.dat` and exited 1 although the staged file has exactly 2097152 bytes (also with `-n 2097151`), so that form of `cmp` is not reliable here and the `head -c` pipe was used instead. The last 64 bytes of both files (offset 2097088) are the same in `xxd`. `~/.bb-crs/bn254_g2.dat` is 128 bytes with sha256 `01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f` | `xxd`, `head -c`, `shasum -a 256`, `cmp` | 2026-11-21 |
| T5.2-d | Repo copies and manifest (task 5.2). After the checks passed, `cp` of the primary files to `src/zk/artifacts/srs/g1.dat` (2097152 bytes) and `g2.dat` (128 bytes); `wc -c`, `shasum -a 256` equal the staged values and `cmp` repo vs staged exits 0 for both. Manifest `src/zk/artifacts/srs/srs.sha256.json` (two-space indent, trailing newline, bytes equal `JSON.stringify(m, null, 2) + "\n"`), keys `format` `bn254-g1-uncompressed-be64`, `pointCount` 32768, `bytesPerPoint` 64, `files`. `g1.dat`: bytes 2097152, sha256 `50d2f4e9567be2b8e382cedfd078b96a3428a94597b7e88c4116e105d578ce77`, source `https://crs.aztec-cdn.foundation/g1.dat`, mirror `https://crs.aztec-labs.com/g1.dat`, byteRange `bytes=0-2097151`. `g2.dat`: bytes 128, sha256 `01797bfc4de5a96f0e516a9ea4537d18786dc30cb991aca4274c95822b69c32f`, source `https://crs.aztec-cdn.foundation/g2.dat`, mirror `https://crs.aztec-labs.com/g2.dat`, byteRange `null`. A node script (`crypto.createHash`) recomputed both hashes from the repo files: both equal the manifest; `pointCount * bytesPerPoint` = 2097152 = g1 bytes. `git check-ignore -v` on `g1.dat`, `g2.dat` and `srs.sha256.json` prints nothing (exit 1, not ignored). Nothing was committed and no `.gitattributes` was written (tasks 5.6 and 5.7) | `cp`, `wc -c`, `shasum -a 256`, `cmp`, `node` (`crypto.createHash`), `git check-ignore -v` | 2026-11-21 |
| T5.3-a | `srsInitSrs` request type and byte-size rule (task 5.3, L4, L5). `api_types.d.ts` line 285: `interface SrsInitSrs { pointsBuf: Uint8Array; numPoints: number; g2Point: Uint8Array }`, and `async.d.ts` line 66: `srsInitSrs(command: SrsInitSrs): Promise<SrsInitSrsResponse>` (response `{ pointsBuf: Uint8Array }`). The design's `{ pointsBuf, numPoints, g2Point }` is correct, no difference. Byte rule (design Q10, L5): bb.js derives the format from `pointsBuf.length / numPoints` (64 uncompressed, 32 compressed), so `initSrs` passes the 2097152 bytes of `g1.dat` and `numPoints` = manifest `pointCount`. `src/zk/srs.ts` types the API structurally (`SrsInitApi`), so it has no runtime bb.js import. | `node_modules/@aztec-foundation/bb.js/dest/node/cbind/generated/api_types.d.ts`, `async.d.ts` | bb.js 6.0.0 |
| T5.3-b | Vite asset imports (task 5.3, L12). Docs: `?no-inline` prevents inlining; assets outside the internal extension list can be imported with `?url`; TypeScript needs `vite/client` for asset imports. `node_modules/vite/client.d.ts` declares `*?no-inline`, `*?url` and `*?url&no-inline`, so `tsc` accepts all of them through `types: ["vite/client"]` and no ambient declaration was added. DIFFERENCE found by running it: `.dat` is not a known asset extension, and a bare `./g1.dat?no-inline` fails in Vite 8.3.8 and Vitest with "Failed to parse source for import analysis ... add `**/*.dat?no-inline` to `assetsInclude`". The asset plugin loads an id only when `assetsInclude(path)` or the `url` query matches (`node_modules/vite/dist/node/chunks/node.js` near line 32507; `noInlineRE` is used at line 32762). Resolution: `srs-assets.ts` imports `...g1.dat?url&no-inline` and `...g2.dat?url&no-inline`, with no `assetsInclude` change and no edit of `vite.config.ts`. | Context7 `/vitejs/vite/v8.3.5` (`docs/guide/assets.md`, `docs/config/build-options.md`), installed `vite` 8.3.8 `client.d.ts` and `dist/node/chunks/node.js` | Vite 8.3.8 |
| T5.3-c | JSON import and `crypto.subtle` (task 5.3). `import manifestJson from './artifacts/srs/srs.sha256.json'` typechecks with the existing `tsconfig.json` (`moduleResolution: "Bundler"` enables `resolveJsonModule` by default), so `tsconfig.json` is unchanged. The manifest is narrowed by `parseSrsManifest(unknown)`, with no cast to `any`. `crypto.subtle.digest('SHA-256', ...)` is the Web Crypto API, a global in browsers, workers and Node 24.14.1 (`typeof crypto.subtle.digest` prints `function`, and the scratch test hashed the 2 MiB file through it). The TS 7 lib types accept only ArrayBuffer-backed views, so `sha256Hex` copies the input with `new Uint8Array(bytes)` before hashing. | `tsc` run in the repo, `node -e`, scratch Vitest run | TS 7.0.2, Node 24.14.1 |
| T5.3-d | Scratch test result (task 5.3, `tests/zk/_scratch-srs.test.ts`, 7 tests passed). Under Vitest `SRS_URLS` = `{"g1":"/src/zk/artifacts/srs/g1.dat?no-inline","g2":"/src/zk/artifacts/srs/g2.dat?no-inline"}` and `SRS_MANIFEST` equals the JSON on disk (`toEqual`). `loadSrs` accepted the committed files and `initSrs` called the api once with `numPoints` 32768, 2097152 `pointsBuf` bytes and 128 `g2Point` bytes. A flipped g1 byte gave `SRS_HASH` `SRS HASH MISMATCH: g1.dat`; g1 shortened by 64 bytes gave `SRS_HASH` `SRS LENGTH MISMATCH: g1.dat`; a flipped g2 byte gave `SRS_HASH` `SRS HASH MISMATCH: g2.dat`; a rejecting source gave `SRS_FETCH` `SRS FETCH FAILED: g1.dat`; `pointCount` 0 gave `SRS MANIFEST INVALID: pointCount`. With a faked `location` of `https://app.example`, `fetchSrsSource` refused `https://evil.example/g1.dat` without calling `fetch`, and fetched `/assets/g2.dat` with `fetch(url, { method: 'GET' })`; with no location any URL was accepted. A throwaway `vite build` (config and entry in `/tmp`, deleted) emitted real files `assets/g1-<hash>.dat` (2097152 bytes) and `assets/g2-<hash>.dat` (128 bytes), and the bundle held the URLs `/assets/g1-<hash>.dat` and `/assets/g2-<hash>.dat`, not data URLs. The type-level check `(b: Barretenberg): SrsInitApi => b` compiled. | scratch Vitest file (deleted after the run), `vite build` with `/tmp` config | Vitest 5.1.1, Vite 8.3.8, 2026-11-21 |
| T5.4-a | `tests/zk/srs.test.ts` setup (task 5.4). `import { BackendType, Barretenberg } from '@aztec-foundation/bb.js'` works unchanged in Vitest 5.1.1 (node environment, no `server.deps` or config change). The one instance is created in `beforeAll` with `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })`, `circuitStats` is called with the same `PROOF_SETTINGS` as T5.1-f on the base64-decoded, `node:zlib` gunzipped Artifact `bytecode`, and `destroy()` runs in `afterAll`; both hooks have a 120000 ms timeout. The whole file (64 tests) runs in about 0.75 s, so the WASM start and `circuitStats` take well under a second. The validators are written in the test file and do not use `parseSrsManifest` to judge the committed files. `parseSrsManifest` and `loadSrs` are used only for the shape-rejection cross-check and the fake-source `SRS_HASH` and `SRS_FETCH` cases. No network use: `skipSrsInit: true` and only local files are read | `tests/zk/srs.test.ts`, `npx vitest run tests/zk/srs.test.ts --reporter=verbose` | Vitest 5.1.1, bb.js 6.0.0, 2026-11-21 |
| T5.5-a | bb.js lookups for `scripts/verify-srs.ts` (task 5.5, L3, L4, U15). `srsInitSrs(command: SrsInitSrs): Promise<SrsInitSrsResponse>` in `dest/node/cbind/generated/async.d.ts` line 66. `api_types.d.ts` line 285: `SrsInitSrs { pointsBuf: Uint8Array; numPoints: number; g2Point: Uint8Array }`, line 504: `SrsInitSrsResponse { pointsBuf: Uint8Array }`. Compressed input is not a separate method or field: `src/barretenberg/index.ts` `initSRSChonk` comments "srsInitSrs auto-detects compressed (32B/point) vs uncompressed (64B/point). When decompressing, it returns the uncompressed bytes", and passes `response.pointsBuf` to `crs.cacheUncompressed` when it is non-empty. So bb.js DOES expose the decompressed points: the response `pointsBuf` holds `numPoints * 64` bytes after a compressed call. The script calls `srsInitSrs({ pointsBuf: <4 MiB x chunks of g1_compressed.dat>, numPoints: chunks * 131072, g2Point })` on `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })` and compares `response.pointsBuf.subarray(0, pointCount * 64)` with the committed `g1.dat` byte for byte. It calls `destroy()` in a `finally`. No API was invented. Node 24.14.1 ran the `.ts` file directly with type stripping under the repo `tsconfig` (U15 holds: no `.mjs` rename, no warning on stdout or stderr); the script imports only `node:` modules and `@aztec-foundation/bb.js`, so `tsconfig.json` needed no `allowImportingTsExtensions` or `erasableSyntaxOnly`. `npm run typecheck` exits 0 | `node_modules/@aztec-foundation/bb.js/dest/node/cbind/generated/async.d.ts`, `api_types.d.ts`, `src/barretenberg/index.ts`, `src/crs/node/index.ts` (L3, L4) | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T5.5-b | First real run of `node scripts/verify-srs.ts` (task 5.5, U15, Requirement 14.4), 2026-11-21 01:34:30 UTC, about 5 s, stdout unmodified, stderr empty, exit status 0: `PASS g1.dat 2097152 bytes` / `PASS g2.dat 128 bytes` / `PASS g1.dat chunk-check 4194304 bytes compressed`. Meaning: (1) the mirror `https://crs.aztec-labs.com/g1.dat` answered HTTP 206 with `Content-Range: bytes 0-2097151/` and its 2097152 bytes equal the committed `g1.dat` byte for byte and by sha256 (`50d2f4e9…ce77`); the mirror `g2.dat` (HTTP 200, 128 bytes) equals the committed `g2.dat` (sha256 `01797bfc…c32f`); (2) one 4 MiB chunk (`ceil(32768 / 131072)` = 1) of `g1_compressed.dat` from the primary host (HTTP 206) was accepted by bb.js, which checks it against its pinned `BN254_G1_CHUNK_HASHES` entry, and the first 2097152 decompressed bytes it returned equal the committed `g1.dat`. What was NOT compared: points beyond index 32767 (the chunk holds 131072, the rest is not part of the committed prefix), and `g2.dat` through the compressed route (bb.js checks the g2 bytes against its pinned hash in the same call, which passed, but there is no compressed g2). Downloads were held in memory, the script writes no file (`git status` unchanged by the run) | `node scripts/verify-srs.ts` | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T5.5-c | Non-vacuity runs (task 5.5, 2026-11-21), on copies in a temp directory outside the repo through the script's `--dir <path>` option (committed files untouched, temp directory deleted). A: g1 byte 1000 flipped, manifest unchanged: `FAIL g1.dat LOCAL SHA256 DIFFERS FROM MANIFEST` / `PASS g2.dat 128 bytes` / `FAIL g1.dat chunk-check DECOMPRESSED BYTE MISMATCH AT OFFSET 1000`, exit 1. B: g1 byte 1000 and g2 byte 5 flipped and the copy's manifest sha256 values updated to match, so only the network comparison can catch it: `FAIL g1.dat MIRROR BYTE MISMATCH AT OFFSET 1000` / `FAIL g2.dat MIRROR BYTE MISMATCH AT OFFSET 5` / `FAIL g1.dat chunk-check Error: SrsInitSrs: g2_point bytes do not match the canonical Aztec [x]_2 SHA-256`, exit 1. C: `--dir` pointing at a missing directory: `FAIL manifest Error: ENOENT ...` on stderr, exit 1. Separate one-off (inline `node --input-type=module -e`, nothing written): the same primary-host chunk (206, 4194304 bytes) with byte 1000000 flipped in memory made `srsInitSrs` throw `SrsInitSrs: g1 compressed chunk 0 SHA-256 mismatch`, so the pinned-hash check is real. Default run after the checks: `npm run typecheck` exit 0, `npm test` exit 0 (4 files, 129 tests) | `node scripts/verify-srs.ts --dir <temp copy>`, inline node | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T6.0-a | `path.isAbsolute` semantics for the generic absolute-path check (task 6.0, Requirements 1.9, 1.10). Context7 `/websites/nodejs_latest-v24_x_api`, page `path.html`: `path.isAbsolute` tests the literal string, returns false for an empty string, throws `TypeError` for a non-string; on Windows it accepts drive paths (`C:/foo/..`, `C:\\foo\\..`) and UNC (`//server`, `\\\\server`); on POSIX only a leading `/`. Checked by running `path.posix.isAbsolute` and `path.win32.isAbsolute` on 15 strings (Node 24.14.1, macOS): `/Users/x/a.nr` posix true, win32 true; `~/x.nr` and `~` both false on both; `C:\x\y.nr` and `D:/a/b.nr` posix false, win32 true; `C:foo` both false (drive-relative, not absolute); `\\srv\s`, `\x` posix false, win32 true; `//srv/x` both true; `src/main.nr`, `std/hash/mod.nr`, `./a`, `.hidden/x.nr`, `a:b`, empty string all false. Decision: the POSIX function misses `~`, drive and backslash forms, so the script uses `path.win32.isAbsolute` (a superset of the POSIX rule on these inputs, same result on every platform) plus explicit rules: leading `~` is form `tilde` (no `path` function and no `fs` call expands it, but a shell would, so it is rejected); the regex `^[A-Za-z]:[\\/]` is form `drive`; a leading `/` or `\` (and anything else `win32.isAbsolute` accepts) is form `absolute`. `C:foo` stays accepted, as the task regex defines the drive form with a separator. | Context7 `/websites/nodejs_latest-v24_x_api` (path), inline `node -e` run, 2026-11-21 | Node 24.14.1 |
| T6.0-b | JSON shape handling for the check (task 6.0). nargo 1.0.0 writes `file_map` as an object keyed by numeric string (the committed Artifact has 5 keys: `17` `std/hash/mod.nr`, `53` `src/hash.nr`, `54` `src/main.nr`, `55` `src/merkle.nr`, `56` `src/posting.nr`), each entry an object with keys `source`, `path`, `function_locations`. Read from the committed Artifact with `JSON.parse` and `Object.keys`. In the escaped text a Windows path is written with doubled backslashes (`C:\\x\\y.nr`); `JSON.parse` turns it into the single-backslash string, so the check on the parsed value sees `C:\x\y.nr` and one rule covers both text forms. Shape rules chosen: `file_map` missing is allowed (nothing to check), `{}` is allowed, any other non-object (null, array, string, number) fails; an entry that is not an object, or has no string `path`, fails; any string value under a key named `path` at any depth inside an entry is checked with the same rule. | committed `src/zk/artifacts/ledger_audit.json`, inline `node -e` | nargo 1.0.0 output, Node 24.14.1 |
| T6.0-c | Side observation while building the scratch harness (task 6.0, relevant to Build_Script known limit 4). With the real `nargo compile --force` (exit 0, nothing on stderr) in a scratch copy, an existing `target/ledger_audit.json` is left UNTOUCHED in at least one case: when the existing file is the real output plus one extra unknown key inside a `function_locations` object (crafted case k), the file stays byte-identical after the compile (checked with `cmp`, 3 repeats). Other hand-edited files (changed `path` values, `file_map` as array, `"path":5`) were overwritten with fresh output. A plausible cause, not verified in the nargo source: nargo reads the existing file, ignores the unknown key when it deserialises, finds the program equal to the new one and skips the write. Consequence: limit 4 is real. A stale or hand-edited `target/ledger_audit.json` can survive `nargo compile --force`, and the Build_Script would read it as fresh. It stays an accepted limit; this task does not change that. | scratch run of `nargo compile --force` plus `cmp`, 2026-11-21 | nargo 1.0.0 |
| T6.0-x | Scratch failure test and re-run result (task 6.0, Requirements 7.2, 7.4, 7.5, 2026-11-21). Setup: scratch directory outside the repo (`mktemp -d` under `/tmp`, resolved to `/private/tmp/...`) with copies of `circuits/`, `scripts/` and `src/zk/artifacts/`, `package.json` `{"type":"module"}`, and a `nargo` shim as a shell script in its own directory, put first on `PATH` only in the child process environment of each run (`--version` printed `nargo version = 1.0.0`; `compile` copied a crafted file to `target/ledger_audit.json`). Each crafted file is the real compile output, with the repo package prefix replaced by the scratch package prefix and one `file_map` path (key `54`, `src/main.nr`) replaced. Every row: exit status 1, artifact directory listing and sha256 of both files unchanged, no `.tmp-*` file. stderr is `build-circuit: step path rewrite failed: <reason>`, with the reason shown here. (a) `/Users/someone/else/file.nr`: `file_map["54"].path is not relative (form: absolute): "/Users/someone/else/file.nr"`. (b) `~/x.nr`: `... (form: tilde): "~/x.nr"`. (c) `C:\\x\\y.nr` as escaped text: `... (form: drive): "C:\\x\\y.nr"`. (d) `D:/a/b.nr`: `... (form: drive): "D:/a/b.nr"`. (e) `/opt/ci/work/src/main.nr`: `... (form: absolute)`. (f) `/var/folders/x/src/main.nr`: `... (form: absolute)`. (g) UNC `\\srv\s\a.nr` as escaped text: `... (form: absolute)`. (h) `file_map` as an array: `` `file_map` is not an object``. (i) `file_map` null: same message. (j) `"path":5`: `` `file_map` entry "54" has no string `path` ``. (k) a nested `path` key `/etc/p.nr` inside entry 17: `file_map["17"].x.path is not relative (form: absolute): "/etc/p.nr"`. Positive cases: the real compile output built with the real `nargo` in the scratch copy (Artifact and Meta deleted first) exit 0, 116843 bytes, Artifact sha256 `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b`, Meta sha256 `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01`, both equal to the committed files; a crafted artifact with no `file_map` key and one with `"file_map":{}` both exit 0 (written, no error). Scratch directory and shim deleted afterwards (`rm -rf` worked; `command -v nargo` prints nothing on the default `PATH`). Re-run in the repo: `PATH="$HOME/.nargo/bin:$PATH" npm run build:circuit` exit 0, `wrote src/zk/artifacts/ledger_audit.json (116843 bytes, sha256 2b08fea5...ecd5b)`; `shasum -a 256` of the Artifact `2b08fea52a19e41a63589033287e3ee54530fdad677c416a6c869c42f1eecd5b` and of the Meta `d62b899bd70c345293004b635eb8002322b5c6b452334b9ed7ad92160c334e01` (equal to the committed values); `git status --short -- src/zk/artifacts` and `git diff --stat -- src/zk/artifacts` both print nothing; the directory holds `ledger_audit.json`, `ledger_audit.meta.json`, `srs` and no `.tmp-*`. | scratch harness (Node driver plus shell shim, deleted), `npm run build:circuit`, `git status`, `git diff --stat` | nargo 1.0.0, Node 24.14.1 |
| T6.1-a | BN254 scalar field modulus for `src/zk/field.ts` (task 6.1, Requirements 3.4, 3.9, 3.10). Found in the installed package: `BN254_FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n` in `dest/node/cbind/generated/curve_constants.js` (the value equals `GRUMPKIN_FQ_MODULUS`, as expected for the two curves of the cycle), and `Fr.MODULUS = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n` in `src/barretenberg/testing/fields.ts`. `node -e "console.log(0x3064...0001n.toString())"` printed the same decimal. `FIELD_MODULUS` in `field.ts` is that decimal literal. | `node_modules/@aztec-foundation/bb.js/dest/node/cbind/generated/curve_constants.js`, `src/barretenberg/testing/fields.ts`, `node -e` | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T6.1-b | `class X extends Error` under `target: ES2022` (task 6.1). With a native ES2022 class target, `instanceof` works without `Object.setPrototypeOf`. Checked by a scratch Vitest file (deleted after the run): a `FieldRangeError` is `instanceof FieldRangeError` and `instanceof Error`, not `instanceof RangeError`; own property names are `stack`, `message`, `field`, `slot`, `name` (the `name` assignment in the constructor creates an own property). `DataView.setBigUint64` and `getBigUint64` (ES2020) are used for the 32-byte conversion so that no `Number` conversion of a field value occurs. | scratch Vitest run, `tsconfig.json` | TS 7.0.2, Vitest 5.1.1, Node 24.14.1, 2026-11-21 |
| T6.2-a | `poseidon2Hash` request and response types (task 6.2, L4, Requirements 3.1, 3.7, 1.9). `dest/node/cbind/generated/api_types.d.ts` lines 124 to 126: `interface Poseidon2Hash { inputs: Uint8Array[] }`; lines 392 to 394: `interface Poseidon2HashResponse { hash: Uint8Array }`. `async.d.ts` line 31: `poseidon2Hash(command: Poseidon2Hash): Promise<Poseidon2HashResponse>` on the async `Barretenberg` (class `Barretenberg extends AsyncApi`, `barretenberg/index.d.ts` line 15); `sync.d.ts` has the same method returning the response directly (`BarretenbergSync`). `async.js` line 315: an `ErrorResponse` from the backend is thrown as `BBApiException`. `src/zk/hash.ts` declares `Poseidon2Api` as `{ poseidon2Hash(request: { inputs: Uint8Array[] }): Promise<{ hash: Uint8Array }> }`. Type-level check: a scratch Vitest file (deleted) used `api satisfies Poseidon2Api` on a real `Barretenberg` and `npm run typecheck` exited 0, so the real class is assignable. | `@aztec-foundation/bb.js` `dest/node/cbind/generated/{api_types,async,sync}.d.ts`, `async.js`, `barretenberg/index.d.ts`; scratch typecheck | bb.js 6.0.0, TS 7.0.2, 2026-11-21 |
| T6.2-b | `poseidon2Hash` element encoding (task 6.2, L4, Requirements 3.1, 3.2). Each input and the output is a 32-byte big-endian field element (same as `.kiro/steering/noir.md` "Hash_Variant"). `fieldToBytes32` rejects any value `>= FIELD_MODULUS` before the call and `bytes32ToField` rejects a result `>= FIELD_MODULUS`, so no wrapping happens in TypeScript. The scratch run matched `PAD_LEAF`, `LEAF_A`, `LEAF_B`, `NODE_A`, `NODE_SMALL`, `EMPTY_ROOT` and the seven all-padding levels of noir.md with the call shapes six inputs (leaf) and two inputs (node). | scratch Vitest run (deleted) against noir.md "Settled choices" | bb.js 6.0.0, 2026-11-21 |
| T6.2-c | SRS need of `poseidon2Hash` (task 6.2, observation for U19, not a decision). With `Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true })` and no `srsInitSrs` call, `poseidon2Hash` returned correct values for all vectors in the scratch run, so no SRS was needed in this run. Task 6.3 still checks `createHasherEnv()` and records the U19 result. | scratch Vitest run (deleted) | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T6.3-a | `Noir` constructor and `execute` in Node (task 6.3, L6, Requirements 1.9, 1.10). `@noir-lang/noir_js` 1.0.0 `lib/program.d.ts`: `class Noir { constructor(circuit: CompiledCircuit); init(): Promise<void>; execute(inputs: InputMap, foreignCallHandler?): Promise<{ witness: Uint8Array; returnValue: InputValue }> }`. `lib/program.mjs`: `execute` calls `this.init()` first, and `init()` only calls `initAbi()` and `initACVM()` when the default imports are functions (web build); in Node it is a no-op. `acvm_js` and `noirc_abi` `package.json` have `main` pointing to `./nodejs/*.js`, which load their WASM synchronously on import. Finding, confirmed by a scratch Vitest run: in Node, `new Noir(circuit)` followed by `await noir.execute(inputs)` works with no WASM initialisation by the caller (no URL, no `init` call). The default foreign-call handler answers `print` with an empty array and throws on any other oracle. An invalid input set (`record_count` 0, 64 padding slots, `EMPTY_ROOT`) made `execute` reject (error constructor `Error`); a valid 2-posting batch (one debit, one credit of 500 cents, 62 padding slots) returned a 14,965-byte compressed witness | `npm pack` contents installed under `node_modules/@noir-lang/noir_js/lib/program.{d.ts,mjs}`, `node_modules/@noir-lang/acvm_js/package.json`; scratch Vitest run (deleted) | noir_js 1.0.0, Node 24.14.1, 2026-11-21 |
| T6.3-b | `CompiledCircuit` type (task 6.3, L8). `@noir-lang/types` 1.0.0 `lib/esm/types.d.ts` lines 150 to 159: `type CompiledCircuit = { bytecode: string; abi: Abi; debug_symbols: string; file_map: DebugFileMap }`; it is re-exported from `@noir-lang/noir_js` and imported as `import type { CompiledCircuit } from '@noir-lang/types'` (a direct dependency, pinned 1.0.0). The committed Artifact has all four keys plus `artifact_version`, `noir_version` and `hash`, which the type does not list. `tests/support/zk-env.ts` parses the JSON as `unknown`, checks `bytecode` (non-empty string), `abi` (object), `debug_symbols` (string) and `file_map` (object) in an `asserts value is CompiledCircuit` function, and passes it on with no `any` and no `as` cast | `node_modules/@noir-lang/types/lib/esm/types.d.ts`, `node_modules/@noir-lang/noir_js/lib/index.d.ts` | types 1.0.0, 2026-11-21 |
| T6.3-c | `Barretenberg.new` options, `destroy`, and U19 (task 6.3, L1, L2). Published types `dest/node/barretenberg/index.d.ts`: `static new(options?: BackendOptions): Promise<Barretenberg>` and `destroy(): Promise<void>`. `dest/node/bb_backends/index.d.ts` `BackendOptions`: `backend`, `threads`, `memory`, `crsPath`, `srsSize`, `wasmPath`, `skipSrsInit?: boolean` (line 81), and others for the native backends. Used: `{ backend: BackendType.Wasm, threads: 1, skipSrsInit: true }` (same as `srs.test.ts`). U19 result: `createHasherEnv()` creates the instance with no `srsInitSrs` call, and `hashLeaf([0, 0, 0, 0, 0, 0])` returned `PAD_LEAF` (`0x0286f724…e8f8`) on the first call (1 ms after creation). So `poseidon2Hash` needs no SRS and the fallback (load the SRS prefix in `createHasherEnv()`) is NOT needed. `createProverEnv()` additionally reads `g1.dat` and `g2.dat` from disk, runs `loadSrs` (length and sha256 checked against `srs.sha256.json`) and `initSrs`; `srs.pointCount` was 32768 and no proof was generated. Timings in this run (Node 24.14.1, this Mac): `createNoirEnv` 1 ms, first `noir.execute` (invalid witness) 104 ms, `noir.execute` valid 76 ms, `createHasherEnv` 240 ms (includes the first WASM load), `createProverEnv` 244 ms (SRS read, hash check and `srsInitSrs` included), `destroy` of all instances under 1 ms | `node_modules/@aztec-foundation/bb.js/dest/node/{barretenberg/index.d.ts,bb_backends/index.d.ts}`; scratch Vitest run (deleted) | bb.js 6.0.0, Node 24.14.1, 2026-11-21 |
| T6.3-d | fast-check 4.10.3 `fc.assert` (task 6.3, Requirement 6.7). Bundled in `node_modules/fast-check/lib/fast-check.{d.ts,js}`. Overloads: `assert(IAsyncProperty, params?): Promise<void>`, `assert(IProperty, params?): void`, `assert(IRawProperty, params?): Promise<void> \| void`. `Parameters` fields used: `seed?: number` (default `Date.now()`), `numRuns?: number` (default 100), `verbose?: boolean \| VerbosityLevel` (default None; level 1 adds the list of failing values, level 2 the execution summary), `reporter?` and `asyncReporter?` (replace the default reporter, which throws when `runDetails.failed`), `includeErrorInReport?: boolean` (puts the predicate's error in the message; otherwise it is attached as `cause`), `endOnFailure`, `path`. How to print the seed: fast-check prints nothing on success, so `tests/support/pbt.ts` writes `PBT <name> seed=<seed> numRuns=<n>` to stdout before calling `fc.assert`. On failure the default message (`preFormatFailure`) already holds `Property failed after <n> tests`, `{ seed: <seed>, path: "...", endOnFailure: true }`, `Counterexample: <shrunk>` and `Shrunk <k> time(s)`; confirmed by a scratch run (`seed 1`, `fc.integer()` with predicate `n < 10`: `Counterexample: [10]`, `Shrunk 29 time(s)`). So no custom reporter is needed | `node_modules/fast-check/lib/fast-check.d.ts` (`Parameters`, `assert`), `fast-check.js` (`preFormatFailure`, `defaultReportMessage`, `buildError`); scratch Vitest run (deleted) | fast-check 4.10.3, 2026-11-21 |
| T6.4-a | `poseidon2Permutation` request and response types (task 6.4, L4, Requirements 3.2, 3.11). `dest/node/cbind/generated/api_types.d.ts`: `interface Poseidon2Permutation { inputs: Uint8Array[] }` (line 127), `interface Poseidon2PermutationResponse { outputs: Uint8Array[] }` (line 395), and the async method `poseidon2Permutation(command: Poseidon2Permutation): Promise<Poseidon2PermutationResponse>` (`async.d.ts` line 32). Each input and output element is a 32-byte big-endian field element, the same encoding as `poseidon2Hash`. The state has 4 elements and the call returns 4 outputs. `tests/zk/hash-kat.test.ts` declares the structural type `PermutationApi { poseidon2Permutation(request: { inputs: Uint8Array[] }): Promise<{ outputs: Uint8Array[] }> }`, and the real `Barretenberg` satisfies it with no cast | `node_modules/@aztec-foundation/bb.js/dest/node/cbind/generated/{api_types.d.ts,async.d.ts}` | bb.js 6.0.0, 2026-11-21 |
| T6.4-b | Reference sponge for the Property 6 cross-check (task 6.4, design Q1, `.kiro/steering/noir.md` "Hash_Variant"). The test builds the sponge only from `poseidon2Permutation`: state `[0, 0, 0, len * 2^64]`, inputs added into `state[0..2]` three at a time (additions modulo `FIELD_MODULUS`, in the test file only), one permutation per block, output `state[0]`. Length 2 is one block with the third slot 0, length 6 is two blocks. Result (Node 24.14.1, WASM, single thread): the bb.js `poseidon2Hash` hasher equals this reference for the six recorded vectors and for 7 six-input and 6 two-input fixed sets (including `p - 1` elements and `2^128`), and a reference with the length tag `5 * 2^64` instead of `6 * 2^64` gives a different `LEAF_A`. The test also reads `.kiro/steering/noir.md` and checks that the six vectors and the five all-padding levels appear there as `0x` plus 64 lowercase hex digits. No mismatch (U3 did not occur) | `tests/zk/hash-kat.test.ts`, `.kiro/steering/noir.md` | bb.js 6.0.0, 2026-11-21 |
| T6.5-a | `InputMap` and `InputValue` types (task 6.5, L7, L8, Requirements 2.4, 2.5, 1.9, 1.10). `@noir-lang/types` 1.0.0 `lib/esm/types.d.ts` lines 1 to 5: `Field = string \| number \| boolean`, `InputValue = Field \| InputMap \| InputValue[]`, `InputMap = { [key: string]: InputValue }`. There is no `bigint`. `@noir-lang/noirc_abi` `web/noirc_abi_wasm.d.ts` re-exports them and declares `abiEncode(abi: Abi, inputs: InputMap, return_value?: InputValue \| null): WitnessMap`; `@noir-lang/noir_js` `lib/program.d.ts` has `execute(inputs: InputMap, ...)`. Assignability: `InputMap` is a type alias with an index signature. A type alias of an object literal type gets an implicit index signature and is assignable to it, an `interface` is not. So `CircuitPosting` and `CircuitInputs` in `src/zk/circuit-inputs.ts` are `type` aliases (with `postings` a mutable `CircuitPosting[]`, matching `InputValue[]`), and `noir.execute(built.inputs)` typechecks with no cast, no helper and no `any` (`npm run typecheck` exit 0) | `node_modules/@noir-lang/types/lib/esm/types.d.ts`, `node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm.d.ts`, `node_modules/@noir-lang/noir_js/lib/program.d.ts`, `tsc` | types 1.0.0, noirc_abi 1.0.0, TS 7.0.2, 2026-11-21 |
| T6.5-b | How integers are encoded as `InputValue` (task 6.5, L7, E-3, design Q2). Decimal strings are used for every `Field`, `u8`, `u32` and `u64`. E-3: `u64` `"1099511627776"` encodes, `u8` `"2"` encodes, `0x` strings are also accepted, a JavaScript number above 2^53 - 1 is rejected, and out-of-range values throw with the value in the message. Confirmed on the real Artifact by a scratch Vitest run (deleted): `noir.execute` accepted the map built by `buildCircuitInputs` (decimal strings for `merkle_root` (a 254-bit value), `record_count`, `limit_cents`, and all six fields of 64 postings) and returned a 15029-byte compressed witness. Conclusion: decimal strings are accepted for `Field`, `u8`, `u32` and `u64`, and `merkle_root` as a decimal string works | E-3 (design), scratch Vitest run against `src/zk/artifacts/ledger_audit.json` | noir_js 1.0.0, noirc_abi 1.0.0, Node 24.14.1, 2026-11-21 |
| T6.5-c | ABI parameter names and types of the committed Artifact (task 6.5, Requirements 2.4, 2.5). Read from `src/zk/artifacts/ledger_audit.json` `abi.parameters` with `node -e`: `merkle_root` public `field`; `record_count` public unsigned integer width 32; `limit_cents` public unsigned integer width 64; `postings` private array of length 64 of struct `posting::Posting` with fields in order `record_id` (field), `account` (field), `side` (unsigned 8), `amount` (unsigned 64), `review_flag` (unsigned 8), `salt` (field). `abi.return_type` is `null`. The keys of `CircuitInputs` and `CircuitPosting` equal these names exactly. The TypeScript names (`recordId`, `amountCents`, `reviewFlag`) are mapped in `toCircuitPosting` only | committed `src/zk/artifacts/ledger_audit.json`, `circuits/ledger_audit/src/{main,posting}.nr` | nargo 1.0.0, 2026-11-21 |
| T6.7-a | `abiEncode` and the ABI JSON shape (task 6.7, L7, L8, Requirements 2.4, 2.5, 2.9, 1.9, 1.10). `@noir-lang/noirc_abi` 1.0.0 `nodejs/noirc_abi_wasm.d.ts` exports `abiEncode(abi: Abi, inputs: InputMap, return_value?: InputValue \| null): WitnessMap` directly, so the test calls the real encoder without `noir.execute`. `@noir-lang/types` 1.0.0 `lib/esm/types.d.ts`: `Visibility = 'public' \| 'private' \| 'databus'`; `AbiParameter = { name; type: AbiType; visibility }`; `AbiType` is a union on `kind` (`field`, `boolean`, `string`, `integer` with `sign` and `width`, `array` with `length` and `type`, `tuple`, `struct` with `path` and `fields: { name; type }[]`); `Abi = { abi_version: 1; parameters; return_type: { abi_type; visibility } \| null; error_types }`. The struct fields carry no visibility of their own: a private array of structs is private as a whole, through the `visibility` of the `postings` parameter. The committed Artifact matches: `abi.parameters` lists `merkle_root`, `record_count`, `limit_cents` (all `public`) and `postings` (`private`, array of length 64 of struct `posting::Posting`), and `abi.return_type` is `null` (read with `node -e` and compared with `toEqual` in `tests/zk/circuit-inputs.test.ts`). Field kinds equal noir.md "Noir integer types": `field`, unsigned 32, unsigned 64; struct fields `field`, `field`, unsigned 8, unsigned 64, unsigned 8, `field` | `node_modules/@noir-lang/noirc_abi/nodejs/noirc_abi_wasm.d.ts`, `node_modules/@noir-lang/types/lib/esm/types.d.ts`, committed Artifact | noirc_abi 1.0.0, types 1.0.0, 2026-11-21 |
| T6.7-b | Errors thrown by `Noir.execute` in `@noir-lang/noir_js` 1.0.0 (task 6.7, L6, design Q5, Requirements 9.5, 9.6). `lib/witness_generation.mjs` `generateWitness`: `abiEncode` runs first and its exception propagates unchanged (no wrapper). Then `executeProgram` from `acvm_js`. In the `catch`, an object error with a `rawAssertionPayload` key goes through `enrichExecutionError`, which MUTATES and rethrows that same error object: if `abiDecodeError(abi, rawAssertionPayload)` returns a string it sets `message = "Circuit execution failed: " + string`, otherwise it sets `decodedAssertionPayload`; it also sets `noirCallStack` (array of strings `at <source text> (<path>:<line>:<column>)` or `at opcode <loc>`) from `debug.mjs` `extractCallStack`, and ignores errors while decoding. Any other error becomes `new Error("Circuit execution failed: " + err, { cause: err })`. `acvm_js` 1.0.0 `nodejs/acvm_js.d.ts` types the raw error as `ExecutionError = Error & { callStack?: string[]; rawAssertionPayload?: { selector: string; data: string[] }; acirFunctionId?: number; brilligFunctionId?: number }`. So no custom error class is defined in `noir_js`: the thrown value is the `acvm_js` error object, a plain `Error`, with extra properties added. Observed in Node: see "Node pre-check (task 6.7)" under "Invalid-witness report". `Noir.execute` also returns `{ witness, returnValue }` and calls `init()` first, which is a no-op in Node (T6.3-a). Not looked up: the constructor and properties of exceptions thrown by `abiEncode` itself (the tests assert only that it throws, E-3) | `node_modules/@noir-lang/noir_js/lib/{witness_generation,program,debug}.mjs`, `node_modules/@noir-lang/acvm_js/nodejs/acvm_js.d.ts`, Vitest run of `tests/zk/circuit-inputs.test.ts` | noir_js 1.0.0, acvm_js 1.0.0, Node 24.14.1, 2026-11-21 |
| T6.8-a | fast-check 4.10.3 APIs for `tests/support/zk-arbitraries.ts` (task 6.8, Requirements 6.1, 6.2). Read from `node_modules/fast-check/lib/fast-check.d.ts`: `bigInt({ min, max })`, `integer({ min, max })`, `nat({ max })`, `constantFrom<T>(...values)`, `oneof({ weight, arbitrary }, ...)`, `record(model)`, `tuple(...arbs)`, `array(arb, { minLength, maxLength, size })`, `Arbitrary.map`, `Arbitrary.chain`, `sample(arb, { numRuns, seed })`, `check`. Observation from a scratch Vitest run (file deleted afterwards): `array` with `maxLength` set and the default `size` kept lengths small (3000 samples gave only 12 distinct `recordCount` values), so the generator passes `size: 'max'` (then all 64 values occurred). Scratch results: 500 witnesses satisfied every invariant; 3000 samples gave `recordCount` min 1, max 64, 412 samples with 1 and 415 with 64; 20 of 20 witnesses were accepted by `buildCircuitInputs` and `noir.execute` (about 10 ms build and 55 ms execute per witness); shrunk counterexamples stayed balanced and within the limit rule | `node_modules/fast-check/lib/fast-check.d.ts`, scratch Vitest run | fast-check 4.10.3, Node 24.14.1, 2026-11-21 |
| T6.12-a | Default-run measurement, per-file durations (task 6.12, Requirements 3.8, 6.2, 6.3, 6.4, 6.8). `npx vitest run --reporter=verbose` at 14:19 (Vitest 5.1.1, Node 24.14.1, this Mac): 10 files, 316 tests, all passed. The verbose reporter prints per-test times and no per-file time, so the per-file figure is the sum of its per-test times. Property 1 `tests/zk/root-parity.prop.test.ts`: 6393 ms for 5 tests, of which the 100-run property is 6210 ms. Property 2 `tests/zk/one-cent-change.prop.test.ts`: 9211 ms for 5 tests, of which the 100-run property is 8951 ms. Property 3 `tests/zk/amount-range.prop.test.ts`: 389 ms (one test, three `fc.assert` calls of 100 runs). Seeds printed: 20261101, 20261102, 20261103 (three lines for P3), each with `numRuns=100`. Earlier measurements by the file authors (P1 about 6.0 to 6.3 s, P2 about 9.3 to 10.5 s, P3 about 0.5 s) agree | `npx vitest run --reporter=verbose` | Vitest 5.1.1, fast-check 4.10.3, 2026-11-21 |
| T6.12-b | Default-run measurement, whole `npm test` (task 6.12). `time npm test`: wall-clock 10.9 s (real 10.896 s, user 28.8 s, sys 2.2 s), Vitest "Duration" 10.07 s, 10 test files, 316 tests passed. The verbose run took 11.1 s wall-clock (Vitest "Duration" 10.10 s). The design expectation for the whole run is about 15 to 60 s, so the run is faster than the lower figure | `time npm test` | Vitest 5.1.1, 2026-11-21 |
| T6.12-c | `T_build` and `T_exec` per witness (task 6.12, formula of task 6.9). A throwaway scratch Vitest file (deleted) drew 100 witnesses with `fc.sample(validWitnessArb, { seed: 20261101, numRuns: 100 })` and timed, per witness, `buildCircuitInputs` (T_build) and `noir.execute` on the committed Artifact (T_exec) with `performance.now()`, using one shared `createHasherEnv()` and one shared `createNoirEnv()`. Run 1: T_build mean 9.04 ms, p95 11.70 ms, max 17.92 ms; T_exec mean 50.64 ms, p95 63.18 ms, max 163.53 ms (the first execute of the file; the other 99 have max 66.80 ms); combined mean 59.68 ms, p95 73.03 ms, max 181.44 ms. Runs 2 and 3 repeat within 1 ms of the means: T_build mean 9.29 and 9.13 ms, T_exec mean 51.25 and 50.41 ms, T_exec p95 64.94 and 60.61 ms. The `fc.sample` draw uses the same seed as Property 1 but is not guaranteed to be the identical witness sequence | scratch Vitest run (deleted) | Node 24.14.1, noir_js 1.0.0, bb.js 6.0.0, 2026-11-21 |
| T6.12-d | New `PROPERTY_TIMEOUT_MS` for Property 1 and Property 2 (task 6.12, formula `max(60 s, 5 x numRuns x (T_build + T_exec))` rounded up to the next 10 s, using the means). Property 1: 5 x 100 x 59.68 ms = 29.8 s, below the floor, so 60 s (was 120 s). Property 2 does one extra execute per run (control), so the formula uses T_build + 2 x T_exec = 110.32 ms: 5 x 100 x 110.32 ms = 55.2 s, below the floor, so 60 s (was 120 s). With the p95 (T_build + T_exec = 73.03 ms; T_build + 2 x T_exec = 135.6 ms) the formula gives 36.5 s and 67.8 s (70 s); the P2 timeout of 60 s is still about 6.7 times the measured 8.95 s run. `numRuns` and seeds unchanged. `WASM_TIMEOUT_MS` and the example timeouts unchanged, P3 keeps 30 s. Both files re-run after the edit: 2 files, 10 tests passed | `tests/zk/root-parity.prop.test.ts`, `tests/zk/one-cent-change.prop.test.ts` | 2026-11-21 |
| T6.12-e | U16 verdict, default-run time (task 6.12). Thresholds: `npm test` under 60 s, and Property 1 and Property 2 under 40 s each. Measured: `npm test` 10.9 s, Property 1 6.2 s, Property 2 9.0 s. PASS. No per-run overhead needed removing (each file already shares one `Noir` and one hasher), `numRuns` was not lowered, and `execute` (about 51 ms) is not a cost that forces moving a property to `test:proof` | measurements T6.12-a to T6.12-c | 2026-11-21 |
| T6.12-f | U19 verdict, `poseidon2Hash` without an SRS (task 6.12). CONFIRMED. The default run builds its hashers through `createHasherEnv()`, which uses `skipSrsInit: true` and no `srsInitSrs`, and all hash and parity tests pass. A search of `tests/` and `src/` shows that the SRS files under `src/zk/artifacts/srs/` are read in the default run only by `tests/zk/srs.test.ts` (its own `node:fs` reads, plus one `skipSrsInit: true` instance for `circuitStats`). `tests/support/zk-env.ts` `createProverEnv()` is the only other reader. It is defined but no test calls it (the folder `tests/zk/proof/` does not exist yet). The default run uses no browser, no prover call (`circuitProve`, `circuitVerify`, `createProverEnv` have no call outside their definition and comments) and no network call (`fetch`, XHR, WebSocket and `sendBeacon` do not appear in `tests/`; the only `http` strings are in comments and in an `artifact.test.ts` mutation sample) | `grep` over `tests/` and `src/` | bb.js 6.0.0, 2026-11-21 |
| T6.12-g | PBT result (task 6.12, Requirement 6.8). Properties 1, 2 and 3 found no defect in the default run, so no regression example test was added and `tests/PBT-LOG.md` is unchanged. No batch data was printed: the run prints the seed lines, the Property 2 message counts (51 and 49) and the existing static-message lines of `artifact.test.ts` | `npm test` output | 2026-11-21 |

## Invalid-witness report

*Filled in by task 6.7 (Node pre-check) and task 9.8 (fill-in list for huynh).*

### Node pre-check (task 6.7)

**This is a Node result, not the browser result.** It was observed with `npx vitest run tests/zk/circuit-inputs.test.ts` on `@noir-lang/noir_js` 1.0.0, `@noir-lang/acvm_js` 1.0.0, `@noir-lang/noirc_abi` 1.0.0, Node 24.14.1, 2026-11-21, by calling `Noir.execute` on the committed Artifact with synthetic postings (four real postings, every value at least 100000, built by the real Witness_Builder). The browser run on the deployed page (Requirement 9) is still pending huynh's run; nothing below is a browser claim.

| Violation | Witness | Threw | Constructor | Message (full) | Assertion text in message | Private value in message | Private value in any own property |
|-----------|---------|-------|-------------|----------------|---------------------------|--------------------------|-----------------------------------|
| Unbalanced | slot 0 amount plus 1 cent, leaves and root recomputed, so only the balance constraint rejects | yes | `Error` | `Circuit execution failed: DEBITS NOT EQUAL TO CREDITS` | yes | no | no |
| Wrong root | valid batch, `merkle_root` plus 1 (`rootOverride`) | yes | `Error` | `Circuit execution failed: MERKLE ROOT MISMATCH` | yes | no | no |
| Over limit, unflagged | slot 0 debit and slot 1 credit of `limit_cents` + 1, only the credit flagged; balanced, honest root | yes | `Error` | `Circuit execution failed: OVER LIMIT WITHOUT REVIEW FLAG` | yes | no | no |

Own property names (`Object.getOwnPropertyNames`), identical in all three cases and in this order: `stack`, `message`, `callStack`, `rawAssertionPayload`, `acirFunctionId`, `brilligFunctionId`, `noirCallStack`.

| Property | Observed value | Source |
|----------|----------------|--------|
| `callStack` | array of one opcode location string: `["4004"]` (unbalanced), `["3188"]` (wrong root), `["4012"]` (over limit) | `acvm_js` |
| `rawAssertionPayload` | `{ selector, data: [] }`, with `selector` `"3436612599554416548"`, `"3275541877112012711"`, `"15773803722799134994"`. Each equals the key of the matching entry in `abi.error_types`. `data` is empty | `acvm_js` |
| `acirFunctionId` | `0` in all three | `acvm_js` |
| `brilligFunctionId` | own property present, value `undefined` | `acvm_js` |
| `noirCallStack` | array of one string, the constraint source text and its location: `at assert(debit_total == credit_total, "DEBITS NOT EQUAL TO CREDITS") (src/main.nr:74:5)`, `at assert(compute_root(leaves) == merkle_root, "MERKLE ROOT MISMATCH") (src/main.nr:60:5)`, and for the limit rule a multi-line `assert(...)` text ending `(src/main.nr:79:9)` | `noir_js` |

Findings:

- `Noir.execute` rejects at the failed constraint. No witness is returned and no proof step is needed to see the failure. Hypothesis H5 (design Q5) holds for the unbalanced case in Node, including the property list.
- The thrown value is a plain `Error` (not a subclass) with the properties above added. Its `message` is `Circuit execution failed: ` followed by the assertion string from `abi.error_types`, so the fixed assertion text can be mapped to a named invariant.
- The three violations have the same constructor and the same own property names, and differ only in the assertion text, the opcode location, the selector and the source text. The shape is consistent.
- Private values: the message and all own properties (`stack` included) were scanned for the decimal, `0x` hex and 64-digit `0x` hex spellings of `record_id`, `account`, `amount` and `salt` of every real posting, as whole tokens (non-alphanumeric delimiters). No field name was found in any case. The scan is by the pure function `leakedFieldNames` in the test file, which has its own boundary examples. `noirCallStack` carries circuit source text, which is not witness data.
- Failure at the ABI encoder is a different path (E-3): its messages can echo input values, and the test asserts only that it throws.
- Still pending: the same observation in the browser (Chrome, deployed page, the Spike_Worker). Requirement 9.5 completes after that report; until then the "Unverified" bullet in `.kiro/steering/noir.md` stays.

## Spike-only files

*Filled in by tasks 8.4 (default-build inspection result) and 9.7 (file list and removal steps).*

## Browser steps for huynh

*Written by task 9.8. huynh fills in the result cells.*

*Line written by task 5.5:* developer command `node scripts/verify-srs.ts` (repository root, needs network). It compares the committed `g1.dat` and `g2.dat` with the mirror host byte for byte and by sha256, and checks the g1 prefix through bb.js's pinned chunk hashes on the compressed route. It prints `PASS` or `FAIL` per check and exits 0 only when all pass. Task 9.8 repeats the command in the steps below.
## Deferred to zk-core
Soundness review passed at commit 9c5e5c8 with no circuit change (huynh, outside Kiro).

1. Padding canonicality: no test sets a non-zero `record_id`, `account`, `side` or `review_flag` in a padding slot (`nonzero_padding_fails` changes only `amount`, `padding_nonzero_salt_fails` changes only `salt`). Not a soundness issue: amount is forced to 0 and every leaf is bound into the signed root. Deferred to zk-core as four extra `nargo` tests (one per field, each alone in a padding slot). They do not change the compiled Artifact.
2. Leaf field order (`leaf_fields`) is not pinned by any `nargo` test. Root parity property P1 (group 6, task 6.9) must catch an order mismatch between TypeScript and the circuit, so P1 must build its inputs through the real Witness_Builder and run `noir.execute` on the committed Artifact. This is a requirement on P1, not a deferral.
3. Boundary tests `record_count = 1` and `limit_cents = 2^40 - 1` (the passing sides of constraints 1 and 3): deferred to zk-core.

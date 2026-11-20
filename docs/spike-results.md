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

## Invalid-witness report

*Filled in by task 6.7 (Node pre-check) and task 9.8 (fill-in list for huynh).*

## Spike-only files

*Filled in by tasks 8.4 (default-build inspection result) and 9.7 (file list and removal steps).*

## Browser steps for huynh

*Written by task 9.8. huynh fills in the result cells.*

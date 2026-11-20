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

## Invalid-witness report

*Filled in by task 6.7 (Node pre-check) and task 9.8 (fill-in list for huynh).*

## Spike-only files

*Filled in by tasks 8.4 (default-build inspection result) and 9.7 (file list and removal steps).*

## Browser steps for huynh

*Written by task 9.8. huynh fills in the result cells.*
## Deferred to zk-core
Soundness review passed at commit 9c5e5c8 with no circuit change (huynh, outside Kiro).

1. Padding canonicality: no test sets a non-zero `record_id`, `account`, `side` or `review_flag` in a padding slot (`nonzero_padding_fails` changes only `amount`, `padding_nonzero_salt_fails` changes only `salt`). Not a soundness issue: amount is forced to 0 and every leaf is bound into the signed root. Deferred to zk-core as four extra `nargo` tests (one per field, each alone in a padding slot). They do not change the compiled Artifact.
2. Leaf field order (`leaf_fields`) is not pinned by any `nargo` test. Root parity property P1 (group 6, task 6.9) must catch an order mismatch between TypeScript and the circuit, so P1 must build its inputs through the real Witness_Builder and run `noir.execute` on the committed Artifact. This is a requirement on P1, not a deferral.
3. Boundary tests `record_count = 1` and `limit_cents = 2^40 - 1` (the passing sides of constraints 1 and 3): deferred to zk-core.

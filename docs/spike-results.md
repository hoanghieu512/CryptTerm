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

## Invalid-witness report

*Filled in by task 6.7 (Node pre-check) and task 9.8 (fill-in list for huynh).*

## Spike-only files

*Filled in by tasks 8.4 (default-build inspection result) and 9.7 (file list and removal steps).*

## Browser steps for huynh

*Written by task 9.8. huynh fills in the result cells.*

# PBT bug log

Real bugs that property-based tests caught in CryptTerm. This log feeds the PBT section of the write-up. Add an entry only for a bug a property actually found, and add the regression example test in the same task.

Each entry uses this format:

```
## YYYY-MM-DD: short title

- Property: name and file of the property that failed
- Seed and counterexample: the fast-check seed, path and shrunk counterexample
- Cause: what was wrong in the code
- Fix: what changed, and the regression test that now covers it
```

## Entries

## 2026-11-23: synchronous throw from the prove service left the run unfailed

- Property: P20 `prove_error_display` in `tests/ui/prove-run.prop.test.ts` (seed 20264020, 200 runs).
- Seed and counterexample: the seed is 20264020. The shrunk counterexample was a synchronous throw of `new Error("PROOF RUN ALREADY ACTIVE")` from `proveBatch`. The fast-check path and the full failure report were not kept from the session.
- Cause: the first version of `runProve` in `src/ui/model/terminal.ts` sent a synchronous throw through a promise. The `UNEXPECTED` failure landed a turn later, so right after PF5 the state still read `proving` and the status line showed no failure text.
- Fix: `runProve` now wraps the `proveBatch` call in `try`/`catch {}` (no bound value) and dispatches `PROVE_FAILED` with reason `UNEXPECTED` at once. The regression example is `prove_error_display: a synchronous throw from the Prove_Port shows UNEXPECTED in the same turn (regression)` in `tests/ui/prove-run.prop.test.ts`. It checks the state with no `await` after the key.
## 2026-11-29: P10 `paging_covers_all_postings` hit the 5 s default timeout under load
- Property: P10 `paging_covers_all_postings` in `tests/ui/ctm200.prop.test.ts` (seed 20264010, 200 runs).
- Seed and counterexample: none. This is a timing failure, not a counterexample. The run passed the 5 s Vitest default limit while the load average was above 100.
- Cause: 200 runs of page rendering over generated batches are slow on a busy machine. The same cause as the earlier P9 timeout (`masked_accounts`).
- Fix: the `it` now has a 30000 ms timeout, as P9 has. No code under `src/` changed.

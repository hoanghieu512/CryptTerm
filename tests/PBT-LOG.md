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

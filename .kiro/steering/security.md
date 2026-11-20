---
inclusion: always
---

# CryptTerm: Security rules

These rules apply to every change. If a task seems to need breaking one, stop and ask huynh. If this file conflicts with another steering file, this file wins.

## What is private and what is public

- **Private:** every posting field (record id, account, side, amount, review flag, salt), the batch text, the circuit witness, and the demo signing key.
- **Public:** `batch_id`, `record_count`, `merkle_root`, `limit_cents`, `signature`, `source_key_id`, `proof`, `circuit_version`, the verification key hash, and the demo public key.

## 1. No batch data in network requests, logs or analytics

- No network request may carry private data. This covers `fetch`, XHR, WebSocket, `sendBeacon`, image pings, form posts and Web Worker `importScripts` or URL parameters.
- No analytics, telemetry, session replay or error-reporting service, now or later.
- No logging of private data. This covers `console.*`, thrown error messages, status line text, and test output. Log batch id and record counts at most.
- Do not put private data in the URL, `localStorage`, `sessionStorage`, IndexedDB, cookies or the Cache API.
- Load everything the app needs from its own origin: scripts, WASM, fonts and samples. No third-party runtime origins.
- Test fixtures and samples use synthetic data only. Never paste real account numbers, PANs or customer data into the repo, a prompt or a log.
- Samples are fetched as static signed files from `public/samples/`. That downloads signed artifacts and uploads nothing.

## 2. The signing key is never imported by `src/`

- The demo private key lives only under `scripts/` (in the core-ledger simulator folder) and is labelled `DEMO ONLY`.
- Nothing under `src/` may import, read, bundle or reference that key or any signing function. Browser code verifies signatures and never creates them.
- Tamper mode must not be able to re-sign an edited batch. That inability is what makes the tamper demo valid.
- The demo key is public by design. Say so in the README and the pitch, and never describe it as a protected secret.
- Enforce the rule with a check that fails the build if the key file or the signing module is reachable from `src/` (import graph, or a search of the built bundle for the private key bytes).

## 3. Amounts are bigint cents

- Amounts are `bigint` cents in TypeScript and an integer type in Noir. No floats at any point: no `Number`, `parseFloat`, `parseInt`, or division by 100 for money.
- Parse amounts from strict digit-only text. Reject signs, decimals, exponents and whitespace.
- Every amount satisfies `0 <= amount < 2^40`. Reject values outside that range. Values near `2^53` and near the field modulus must be rejected, not wrapped.
- Format amounts for display with integer arithmetic and string handling only.
- Bundle fields that hold bigint values are decimal strings.

## 4. Circuit soundness

- The circuit must range-check every amount, including every padding slot, so that field arithmetic cannot wrap and no amount can be negative.
- The circuit must bind padding. Every slot from 0 to `N - 1` is hashed into the Merkle tree as a leaf, whether it is real or padding. For slots at index `>= record_count`, the circuit must force amount 0 and a neutral flag and side, so that padding cannot change either sum or the limit rule.
- `record_count` must be constrained to `1 <= record_count <= N`. Real postings are exactly the slots below `record_count`.
- `side` is exactly D or C. `flag` is exactly Y or N. Constrain these explicitly and do not trust the witness.
- Comparisons on field elements need a prior range check, or they prove nothing.
- Every constraint needs a failing `nargo test`. A circuit change that alters constraints goes through the soundness-reviewer agent before it is accepted.
- Signature verification stays outside the circuit, so the verifier must run it. The verifier must also check that the bundle's public inputs match the signed digest, and that `limit_cents` equals the verifier's own policy.

## 5. The verifier fails closed

- Any missing field, unknown field, wrong type, parse error or thrown exception while verifying produces REJECTED with the failing step. It never produces VERIFIED.
- VERIFIED is shown only when every step passed.

## 6. The proof bundle holds only public values

- The bundle contains exactly the public fields listed above and nothing else. A test checks its keys against an allow-list.

## Enforcement

These checks are planned and are not all in place yet. When writing the code they protect, add the matching check in the same task:

- A scan of `src/` for network APIs and for `console.*` calls that could print private data (hook and CI).
- A check that nothing in `src/` can reach the signing key.
- Property tests for amount rejection near `2^53` and near the field size.
- `nargo test` failure cases for each circuit constraint.
- A bundle allow-list test.

# CryptTerm: Product

CryptTerm is a green-screen, block-mode terminal web app. A bank operations engineer uses it to prove, with a zero-knowledge proof generated in the browser, that a signed settlement batch satisfies compliance invariants. The proof reveals no posting, account, amount or customer data. A separate verifier screen checks the resulting proof bundle.

Entry: Kiroween 2026, category Resurrection. The resurrected technology is the block-mode terminal workflow (forms, PF keys, status line, whole-screen submit) that banks still run, reborn as a privacy-preserving audit workstation.

## Users

- **Prover:** a SecOps or operations engineer at a bank's core ledger or card switch.
- **Verifier:** a party with no privilege to see raw data, such as a card network partner, a correspondent bank, a cyber insurer, or the public. Regulators and PCI assessors can see raw data under their own powers, so they are not the target audience.
- A secondary persona (a quant fund proving risk discipline to LPs) appears as one line in the pitch and nowhere else. Do not design for it.

## The claim

> This batch, signed by our core ledger, balances (sum of debits equals sum of credits) and every posting is within the limit or carries a review flag.

The raw log holds PANs, account numbers and balances. Sharing it with a non-privileged party needs NDAs, access agreements and data-protection review. A proof needs none of these.

## Goals

- A judge opens the URL, loads a sample batch, generates a proof, opens the verifier, sees VERIFIED, then tampers with one cent and sees it fail. This takes under 2 minutes, with no install and no login.
- Kiro use is deep, honest and visible: specs, steering, hooks, property-based tests, MCP, custom agents, IDE and CLI.
- A video under 3 minutes shows the tamper moment clearly.

## Non-goals

- Real mainframe or ISO-8583 integration. A built-in generator plays the role of the core ledger.
- Timing invariants such as "rollback under 500 ms". They need trusted timestamps.
- Uploading arbitrary batches signed by an arbitrary key. Out for v1.
- Phone-first layout. Desktop first. On a phone the UI must scale and stay readable, nothing more.
- A shell with a virtual file system. Block-mode does not need one.

## Anti-goals

Any of these is a failure even if everything else works.

- A proof over data the prover could have fabricated. The signed commitment is mandatory.
- Raw batch data leaving the browser. No network call may carry batch contents, and there is no analytics.
- Code in the repo written by anything other than Kiro. Otherwise `.kiro/` is decorative and the write-up is dishonest.
- Third-party trademarks in the app, docs or video. Never write "IBM" or "3270". Say "block-mode terminal".
- A generic xterm-style "CRT terminal" look that blends into every other retro entry.

## Trust model

- A simulated core ledger emits a batch file plus a signed digest. The digest is an Ed25519 signature over `(batch_id, merkle_root, record_count)`, made with a demo core-ledger key.
- The verifier trusts the core-ledger public key. It ships in the verifier as the known source key and is labelled as a demo key.
- The proof shows that the private postings hash to `merkle_root` and that the invariants hold.
- The verifier checks the signature outside the circuit. It then checks that the proof's public inputs match the signed digest and the expected policy, and then verifies the proof.
- Sample batches are generated and signed at build time by a repo script. The browser bundle contains only signed artifacts and the public key, never the private key.
- The demo private key is committed in the generator folder and labelled `DEMO ONLY`, so judges can reproduce the samples. The README and pitch state plainly that this key is public by design. In production it lives in the core system or an HSM.
- Consequence: an edited batch cannot be re-signed in the browser. The tamper demo depends on this.
- **Policy limit:** the limit is the verifier's policy, not the prover's choice. The verifier holds the expected `limit_cents` (default 1,000,000 cents, editable on CTM900) and rejects any bundle whose public `limit_cents` differs. The prover's CTM300 field is prefilled with the same default. A looser limit produces a bundle that the verifier rejects at the policy step.

## Screens

The UI is 80x24 block-mode: a fixed grid, fields, PF keys and a status line. Input is submitted as a whole screen, not character by character.

| ID | Name | Purpose |
|----|------|---------|
| CTM000 | LOGON | Title and "PRESS ENTER". No real login. |
| CTM100 | BATCH SELECT | List the built-in samples: clean, unflagged over-limit, unbalanced, large. Select and press Enter. |
| CTM200 | BATCH VIEW | Paged postings with masked account numbers, totals, and the signature status of the digest. PF12 enters tamper mode, where one amount is edited in place. |
| CTM300 | PROVE | Policy limit field, PF5 to generate the proof, progress in the status line, then the result. Export the bundle (copy or download) and link to the verifier. |
| CTM900 | VERIFY | Own route with a shareable URL. Paste or drop a bundle and press Enter. A checklist follows: signature valid, public inputs match digest, policy matches, proof valid. The result is VERIFIED, or REJECTED with the failing step. |

## Tamper demo

Both cases appear in the video.

1. **Edit one amount by 1 cent.** The sums no longer balance, and proof generation fails with a clear message.
2. **Move 1 cent between two postings** (still balanced). The proof generates, but the root no longer matches the signed digest. The verifier rejects at the signature/root step.

Never cut this demo or the verifier to save scope or credits.

## Voice and copy

- Terminal copy is uppercase, terse and operational, like a bank operations screen. Example: `PROOF GENERATION FAILED: DEBITS NOT EQUAL TO CREDITS`.
- Error messages name the failing invariant or verifier step. Never show a generic "something went wrong".
- Say "block-mode terminal", "posting", "batch", "digest" and "proof bundle". Use one term per concept.
- Label the demo key and demo data as demo wherever they appear.

## Delivery constraints

- Dates are in Vietnam time. Spike gate is Nov 19. Feature work runs Nov 20 to Nov 30. Deploy and polish on Dec 1, video on Dec 2, write-up on Dec 3, buffer and submit on Dec 4.
- Credit budget is about 2500. Default model is Sonnet 5.5. Use Opus 5.5 (2x cost) only for circuit soundness review.
- Phase budgets: spike 300, ledger and generator 400, ZK core and parity 600, UI 600, verifier 300, polish and write-up support 300.
- Check the credit balance at the end of each phase. If a phase overruns by more than 30%, cut UI scope first (fewer sample batches, simpler effects).
- Keep a log of real bugs that property-based testing caught. It feeds the write-up.
- License: MIT unless huynh chooses Apache-2.0.

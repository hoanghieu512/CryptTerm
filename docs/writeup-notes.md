# CryptTerm: write-up notes

Running notes for the Kiroween write-up, blog and video. Add entries as things happen, newest last in each section. Record what actually happened, including mistakes. The write-up must stay honest about how Kiro was used.

Dates are Vietnam time. Related logs: the PBT bug log is `tests/PBT-LOG.md` (not created yet).

## Steering and process

### 2026-11-18: "Look up, don't recall" caught the `bb.js` package rename

- **Rule:** `.kiro/steering/noir.md` tells Kiro to look up Noir, `noir_js` and `bb.js` details in the docs instead of recalling them, and to check installed versions before relying on them.
- **What happened:** The brief pinned `bb 6.0.0` and said to find the matching `bb.js` npm version. Kiro queried the npm registry instead of assuming `@aztec/bb.js@6.0.0` existed. That returned a 404, and `noir.md` first recorded the pin as unresolved.
- **A mistake in between:** Kiro wrongly concluded that no `bb.js` 6.0.0 existed, because it had only searched the old package name. It wrote that into `noir.md` and told huynh.
- **How it was corrected:** A follow-up lookup of the Noir tutorial showed imports from `@aztec-foundation/bb.js`. The registry confirmed that `@aztec-foundation/bb.js` has `latest` set to `6.0.0`, while `@aztec/bb.js` stops at `5.3.0`. `noir.md` was fixed and the old name is now marked as not to be installed.
- **Takeaway for the write-up:** the rule forced registry checks that exposed the rename, and the first answer was still wrong until the same rule was applied a second time. Open check for the spike: `@aztec-foundation/bb.js` 6.0.0 with `noir_js` 1.0.0, against the `bb 6.0.0` CLI.

### 2026-11-18: Context7 was stale on the package name

- Context7 (`@upstash/context7-mcp@4.7.3`) returned a `noir_js` example that imports `@aztec/bb.js`. The example comes from the Noir repository's `master` branch.
- The npm registry says the current name is `@aztec-foundation/bb.js`. Context7 also has no entries pinned to Noir 1.0.0, so its answers describe `master`.
- **Practice adopted:** treat Context7 as a source for call shapes and syntax. Cross-check every package name and version against the npm registry and the published package source. When they disagree, the registry wins. This is written into `noir.md`.
- Context7 and the published package source agreed on the call sequence: `new Noir(circuit)`, `noir.execute(inputs)`, `new UltraHonkBackend(bytecode, api)`, `generateProof(witness)`, `verifyProof(proof)`.
- Neither source confirms that `noir.execute` throws when a constraint fails. `noir.md` marks this as unverified, to be tested first in the spike, because the first tamper case depends on it.

### 2026-11-18: `.kiro/settings/` is write-protected for agents

- A permission rule denies agent writes to any `.kiro/settings/` path. Kiro tried to create `.kiro/settings/mcp.json` for Context7 and was blocked. It did not work around the rule with a shell redirect.
- Kiro still did the lookup by starting the same pinned Context7 server by hand from `/tmp`, over stdio.
- huynh then added the MCP server through the Kiro UI. The entry landed in the user-level file `~/.kiro/settings/mcp.json`, not in a workspace file. It is pinned to `@upstash/context7-mcp@4.7.3` and has no API key.
- Kiro then called the Context7 tools natively (`resolve-library-id` returned the Noir libraries `/noir-lang/noir` and `/websites/noir-lang`).
- **Why this is worth telling:** the protection means that the agent cannot change its own tool access or the config of its tools. Only huynh can. It is a sensible default for an agent that handles a signing key and a security-sensitive circuit.

### 2026-11-18: Hosting moved from Cloudflare Pages to Netlify

- The Netlify power was installed, and hosting was switched. `tech.md` and `structure.md` were updated, and `noir.md` and `security.md` had no Cloudflare mentions.
- Headers and SPA fallback: the brief named `public/headers` and `public/redirects`. The Netlify documentation names them `_headers` and `_redirects`, both with a leading underscore and no extension. Files without the underscore are ignored. Steering uses the documented names.
- The SPA fallback matters because CTM900 is its own route with a shareable URL, and a direct visit must load the app.
- Kiro does not deploy without huynh's say-so. The steering file asks for a non-production deploy by default and a `netlify status` check first.

### 2026-11-18: Powers reviewed

Decisions by huynh. At the time of writing, only the Netlify power is installed under `~/.kiro/powers/installed/`.

| Power | Decision | Reason |
|-------|----------|--------|
| Netlify | Installed | Used for deploys. Hosting moved to Netlify. |
| Kane CLI | Kept | Reserved for an exploratory pass in Task 7. |
| Security powers | Skipped | They target cloud infrastructure, and this static app has none. The app's security rules live in `security.md` and in checks that run on the source. |

### 2026-11-22: Circuit auditor, first run (zk-core task 1.4)

Agent file: `.kiro/agents/circuit-auditor.json`. It is read-only: the tool list is `read`, and `permissions.rules` deny `fs_write` and `shell`. The format comes from the Kiro "Configuration reference" for custom agents (kiro.dev/docs/custom-agents/configuration-reference/), which covers IDE 1.0 and CLI V3.

Scope: `circuits/ledger_audit`, `src/zk/witness-builder.ts`, `src/zk/batch-root.ts`.

Command, run once from the repo root on 2026-11-22, exit status 0:

```
kiro-cli chat --v3 --agent circuit-auditor --no-interactive --trust-workspace --trust-tools=read "Audit circuits/ledger_audit, src/zk/witness-builder.ts and src/zk/batch-root.ts as described in your instructions. Report findings in the report format. Do not modify anything."
```

Quirk: without `--v3` the headless run picks the V2 engine, which cannot load a V3-only agent file (`Mode 'circuit-auditor' not found`, exit status 4). `kiro-cli agent list` shows the agent either way, so the listing does not prove that a headless run will find it.

Findings (the agent reported four, none a real soundness or parity break; no circuit or witness code was changed):

1. Test gap claim: five constraints (`RECORD COUNT BELOW 1`, `RECORD COUNT ABOVE CAPACITY`, `LIMIT OUT OF RANGE`, `SIDE NOT D OR C`, `FLAG NOT Y OR N`) have no failing `nargo test`. Not a finding. The agent saw only part of a grep and said so itself. `circuits/ledger_audit/src/tests.nr` has a `should_fail_with` test for each of them (`record_count_0_fails`, `record_count_65_fails`, `limit_at_2_pow_40_fails`, `side_value_2_fails`, `review_flag_value_2_fails`), and `nargo test` passes all 26 tests. Action: none.
2. `record_id`, `account` and `salt` are not range-checked in the circuit, while the TypeScript builder limits them to 64, 64 and 248 bits. Known and recorded in `noir.md` ("Leaf and field encodings"). The root is signed, so a different preimage needs a Poseidon2 collision. Action: none.
3. `assembleCircuitInputs` does not force padding slots to be neutral, and must not reach production code. It builds crafted witnesses for tests, and `buildCircuitInputs` always pads with `PADDING_POSTING`. Checked by search: only `src/zk/witness-builder.ts` and four test files name it. Action: none. The `zk_static_scan` of group 4 could pin this later.
4. `batchRoot` takes the count from `batch.postings.length`, so nothing in these three files ties it to the signed `record_count`. The parser rejects a trailer count that differs from the posting lines (`COUNT_MISMATCH` in `src/ledger/parse.ts`), and the verifier's `DIGEST_MATCH` step compares the proof's count with the signed one. Action: none.

Status: no finding is open and nothing awaits huynh. The agent's own caveat stands: it read the code and ran nothing.

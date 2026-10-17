# Rollout and rollback

`0.0.1` remains the hackathon line. `0.1.0` is this agent and UI change. Publishing the site is a separate step. No program upgrade is required for `0.1.0`.

Rollback the agent to a single provider by setting `KAIROS_ORACLE_PROVIDER=pyth-pro` and `KAIROS_SUBSCRIPTION_PLAN=operator` or by leaving fallback off. Schema v1 Pyth Pro reports still create proposals. Stored v1 receipts stay readable because verification hashes the proposal body that was signed.

Emergency path: stop calling a provider whose license or credential is missing. The validator blocks. No AAPLx mainnet transaction is constructed by this line.

Canary: set `KAIROS_ORACLE_PROVIDER` per environment. Do not infer it from the feed id.

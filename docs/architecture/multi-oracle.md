# Multi-oracle evidence

Product line `0.1.0`. Schema `oracle-evidence-v2`.

The agent asks an explicit provider id for reference evidence. `pyth-pro` and `pyth-hermes` are adapters over the existing fetch functions. `chainlink`, `switchboard`, and `redstone` are registered and disabled. The provider is never chosen from the shape of the feed id.

`KAIROS_ORACLE_PROVIDER` sets the agent default. When it is unset, the default is the literal `pyth-pro`. A previous regex on the feed id did not match numeric ids and sent them to Hermes. That inference is gone.

The Devnet program still reads the owner-posted reference price. It does not read Pyth, Hermes, or Chainlink. Jupiter remains the executable quote. `executionMode` stays `APPROVAL_ONLY`.

The digest on v2 evidence is the SHA-256 of the canonical parsed price. The existing fetch functions do not return the raw HTTP body, so the digest is not a hash of bytes on the wire.

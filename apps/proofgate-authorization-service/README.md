# ProofGate Authorization Service

Local deterministic boundary for the Settlement Lab. It is not a public API and it does not hold the owner's key.

Install from the workspace root:

```bash
pnpm install
pnpm --filter @valuecurator/proofgate-authorization-service test
```

The package declares `@solana/web3.js` `1.99.0` and `tweetnacl` `1.0.3`. Tests import those packages by name. They do not reach into `programs/settlement-lab-tests/node_modules`.

The Next.js lab route loads this package on the server. The policy key path is `LAB_POLICY_KEYPAIR_PATH` and must stay outside Git.

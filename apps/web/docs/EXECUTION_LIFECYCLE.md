# KAIROS execution lifecycle

## Current safe boundary

The real AAPLx/Pyth/Jupiter market evidence is read from Solana Mainnet, while
the KAIROS program is deployed on Devnet. The application therefore supports
an auditable **approval-only** stage and deliberately does not submit a real
AAPLx transaction.

1. `check:market` collects live Pyth, xStocks and Jupiter evidence without a wallet.
2. `propose:execution` hashes that evidence and creates an immutable proposal.
3. The dashboard verifies the proposal hash in the browser.
4. The configured owner may sign the exact proposal with Phantom or Solflare.
5. The browser exports a receipt containing the proposal, evidence digest,
   signer and detached signature.
6. `verify:approval` verifies the Ed25519 signature, signer, hashes and validity window.
7. No transaction is constructed or submitted by this approval action.

The short proposal validity is intentional: it inherits the maximum permitted
age of the underlying market observation. An expired proposal must be regenerated.

## Conditions required before Mainnet execution

Real execution must remain disabled until all of the following are true:

- the KAIROS program is reviewed, deployed and initialized on Mainnet;
- the program, market evidence, input mint and output mint are on the same network;
- the owner and operator roles use separately controlled production keys;
- the exact-input amount, minimum output and asset identifiers are bound to the signed proposal;
- the approval signature is verified before transaction construction;
- simulation succeeds immediately before submission;
- the persistent risk guard allows the attempt;
- only a confirmed transaction consumes the daily quota;
- the final report records the signature, slot, balances and policy version.

Removing the approval-only lock without meeting these conditions is a security
regression, not a feature toggle.

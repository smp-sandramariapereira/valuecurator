# Program-key rotation and migration

The deploy key previously committed under `target/deploy/` must be treated as compromised.
Deleting it from the current tree does not remove it from Git history.

## Required migration

1. Check the upgrade authority of the old Devnet program.
2. Clone this branch on a trusted machine.
3. Run `pnpm install`.
4. Run `pnpm rotate:program-key`.
5. Review every Program ID replacement.
6. Run `pnpm test:e2e`.
7. Deploy the new program to Devnet.
8. Initialize fresh nodes using distinct owner and operator keys.
9. Retire the old program and invalidate any automation using the old identity.
10. Schedule a coordinated history rewrite using `git filter-repo --path target/deploy/kairos_engine-keypair.json --invert-paths`, then force-push every affected branch and tag.
11. Require every collaborator and CI runner to discard old clones and caches; old objects remain recoverable from existing clones until they are removed.
12. Enable repository secret scanning and push protection in GitHub settings.

The rotation script writes the new private deploy key only to
`target/deploy/kairos_engine-keypair.json`, with mode 0600. The path is
gitignored. Back up this key through the team's approved secret-management
process; never upload it to GitHub, chat, CI logs, or a public artifact.

## Authority model

- **owner**: cold governance authority; rotates the operator and performs emergency recovery.
- **operator**: limited hot key; processes yield and sends vaulted assets only to the allowlisted strategy.
- **strategy authority**: fixed destination authority configured during node initialization.
- **treasury**: fixed authority receiving the infrastructure allocation.

## Repository guardrail

Run `pnpm security:check` before every push. CI rejects tracked `.env` files, private-key formats, deploy directories, and JSON files shaped like Solana 64-byte keypairs. This protects the current tree; it does not sanitize existing Git history or revoke an already exposed on-chain authority.

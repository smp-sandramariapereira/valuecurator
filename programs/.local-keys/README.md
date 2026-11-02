# Local keys

This directory holds the Settlement Lab program keypair used only by the
offline Surfpool suite. The keypair file matches `**/*-keypair.json` in the
repository ignore rules and must stay untracked.

The public address is the `declare_id!` in
`proofgate-settlement-lab/src/lib.rs`. It is not a public Devnet deployment
and it is not the KAIROS program id.

`proofgate-config-initializer.json` is the only key allowed to create the
singleton ProofGate configuration. Its public key is
`BMa9qun9QuCceSgozPtPNwQarro5CvQ63Twv3jDWcY8a`. It is not the policy signer.
The test creates the policy signer in memory for that process and does not
write it here.

Do not copy the keypair into docs, fixtures, or chat logs.

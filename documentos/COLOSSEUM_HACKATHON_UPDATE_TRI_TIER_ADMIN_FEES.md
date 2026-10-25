# 🏛️ ValueCurator — Architecture Modularization & Tri-Tier On-Chain Fee Engine (`feat/tri-tier-admin-fees`)

### 1. Architectural Separation: Standalone IP Tokenization vs. Core Fiduciary Custody
To keep **ValueCurator** (`smp-sandramariapereira/valuecurator`) laser-focused on sovereign capital custody, deterministic neurosymbolic policy gating, and institutional treasury management, we extracted our endogenous IP & Research NFT minting suite (`SPL Token-2022` + `EidosManifest v1.0`) into a dedicated standalone repository under the Compilatorum organization:
* **Standalone Tokenization Repo**: [`compilatorum/eidos-tokenization`](https://github.com/compilatorum/eidos-tokenization)
* **Core Fiduciary & Fee Governance Branch**: [`smp-sandramariapereira/valuecurator` (`feat/tri-tier-admin-fees`)](https://github.com/smp-sandramariapereira/valuecurator/tree/feat/tri-tier-admin-fees)

---

### 2. Tri-Tier Administrative Fee Engine on Solana (`kairos-engine`)
On branch `feat/tri-tier-admin-fees`, we upgraded the `NodeAccount` PDA state (reclaiming 26 of the 32 reserved tail bytes with **zero account-size layout break**) and implemented three complementary, deterministic administrative fee instructions routed to the protocol `Treasury PDA`:

1. **Tier 1 — Deposit / Entry Fee (`deposit_with_fee`)**:
   * Charged atomically upon capital inflows into the sovereign `Node PDA` vault (`default: 50 bps = 0.50%`).
   * Executes a dual `SPL Token-2022` `transfer_checked` CPI: routes the entry fee slice (`deposit_fee_bps`) directly to `treasury_token` and credits the net principal (`net_vaulted`) into `vault_token`, emitting `DepositFeeCollectedEvent`.
2. **Tier 2 — Periodic Node Maintenance Fee (`collect_periodic_fee`)**:
   * Enforces a predictable SaaS infrastructure subscription (`default: 1.00 USDC / 30-day epoch = 2,592,000s`) tracked on-chain via `last_periodic_fee_ts`.
   * Strictly **fail-closed (`PeriodicFeeNotDue`)** if less than one full epoch has elapsed. When due, the `Node PDA` signs the CPI transfer of `epochs_settled * periodic_fee_amount` to `treasury_token` and advances the epoch cursor, emitting `PeriodicFeeCollectedEvent`.
3. **Tier 3 — Performance / Yield Metabolism Fee (`metabolize_yield`)**:
   * Charged **exclusively on positive strategy yields** (`default: 1500 bps = 15.00%`), never touching the user's vaulted principal.
   * Routes `15%` of realized yield to `treasury_token` and compounds `85%` into the user's `vault_token`, while updating `total_metabolized` and `total_admin_fees_collected`.
4. **Sovereign Fee Governance (`configure_admin_fees`)**:
   * Owner-gated instruction allowing constitutional updates to `deposit_fee_bps`, `periodic_fee_amount`, and `infrastructure_fee_bps` (bounded by `<= 10,000 bps`), emitting `AdminFeeScheduleUpdatedEvent`.

---

### 3. Code & Verification Summary
* **Rust / Anchor (`apps/web/programs/kairos-engine/src/`)**:
  * Added `deposit_with_fee.rs`, `collect_periodic_fee.rs`, and `configure_admin_fees.rs`.
  * Extended `math.rs` with `split_deposit_fee` and `calculate_periodic_fee_due` + unit tests verifying 50 bps entry splits, premature epoch rejection, multi-epoch settlement, and 15/85 yield metabolism.
* **TypeScript Agent SDK (`apps/web/agent/src/admin-fee-schedule.ts`)**:
  * Added deterministic `BigInt` mirrors (`computeDepositFeeSplit`, `computePeriodicFeeDue`, `computePerformanceFeeSplit`) for pre-flight UI & agent verification.

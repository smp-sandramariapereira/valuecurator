# Stage 1 — Asset Registry (research-only)

Status: **initial implementation on feature branch**. No deployment, wallet operations, multiasset mandate enforcement, or new Devnet mints.

## What exists
- `apps/web/data/asset-catalog.json`: versioned data-driven asset candidates; AAPLx Mainnet mint is recorded from existing project documentation. Other tickers are unverified candidates without mint addresses.
- `apps/web/lib/asset-registry.ts`: strict parsing, canonical Solana key validation, unique stable asset IDs, multiasset research selection, fail-closed Devnet eligibility predicate.
- `apps/web/app/assets/page.tsx` + `components/asset-catalog-viewer.tsx`: isolated, read-only `/assets` page with asset search and multi-select. UI selection remains local and cannot authorize or construct transactions.
- `apps/web/lib/asset-registry.test.ts`: test scenarios for identities, duplicate selections, unknown assets, spoofed mint information and Devnet-denied candidates.

## Important distinctions
`assetId` is distinct from company ticker, on-chain mint and financial entitlement. `REFERENCE_DOCUMENTED` denotes an existing internal mapping and is **not independently issuer-verified**. Neither `REFERENCE_DOCUMENTED` nor `CANDIDATE` is Devnet-executable. The API and proof of issuance require future verification and settlement infrastructure.

## Local verification (not executed via GitHub connector)
```bash
pnpm install --frozen-lockfile
pnpm --filter @valuecurator/web exec node --import tsx --test lib/asset-registry.test.ts
pnpm --filter @valuecurator/web exec tsc --noEmit
pnpm build:web
pnpm security:check
```
If tsx is not available in the web package's executable context, run the test from the agent workspace with an explicit test path or add a dedicated test runner in a subsequent lockfile-synchronized change.

## Remaining before Stage 1 acceptance
1. Run tests, typecheck, build and baseline security checks on a checked-out branch with dependencies.
2. Add authenticated discovery/verification workflow with independent issuer metadata, network-specific mint validation and provenance review.
3. Add application navigation to `/assets` if approved; currently the route is directly addressable.
4. Design persistent owner mandates; research checkboxes are intentionally not mandates.
5. Do not enable Devnet settlement until signed mandate/enforcement and test mint provisioning pass the security gates.

# @valuecurator/discovery-contracts

Shared transport/domain contracts between `apps/web` and `apps/discovery-api`.

## Currently exported

- `InterviewStateSchema`
- `InterviewState`
- `STATES`

## Next extraction candidates (not yet migrated)

- `Answer` / `AnswerSchema`
- `Evidence` / `EvidenceSchema`
- `ResearchProfile`
- `AuthorizationBlueprint` (non-binding research artifact)
- API request/response envelopes

Extract only when both apps can consume the contract without circular
dependencies or runtime semantic changes.

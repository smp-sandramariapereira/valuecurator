# ValueCurator Discovery Agent

> AI-assisted customer discovery and mandate elicitation for evidence-gated autonomous finance.

## Overview

ValueCurator Discovery Agent is the research and intent-elicitation layer for ValueCurator.

Its first purpose is to conduct structured customer-discovery interviews with builders and operators of autonomous financial systems. The agent captures responses, asks bounded adaptive follow-up questions, extracts traceable evidence, and converts the interview into useful research artifacts.

The same interview engine is designed to evolve into a future **Mandate Elicitation** workflow, where an owner can describe financial intent conversationally and receive a structured draft mandate for deterministic validation and explicit human approval.

This repository is intentionally separate from the KAIROS Engine. It does not custody assets, hold private keys, construct financial transactions, or bypass ValueCurator authorization policy.

## Product Principle

**AI advises. Evidence proves. Policy authorizes. The owner controls the capital.**

For the Discovery Agent, that principle means the LLM may conduct an interview, structure intent, and extract evidence, but it must not convert natural-language responses directly into executable financial authority.

## Current Objective

The MVP supports ValueCurator customer discovery through a dedicated web interview experience.

Primary flow:

```text
ValueCurator Interview
        ↓
Connect Solana Wallet
        ↓
Sign Authentication Message
        ↓
Consent
        ↓
Adaptive AI Interview
   ├── Text
   └── Voice
        ↓
Evidence Extraction
        ↓
Research Profile
        ↓
Authorization Blueprint
        ↓
Design Partner / Shadow Pilot CTA
```

The target interview duration is approximately **5–8 minutes**.

## Target Participants

Initial customer-discovery segments:

1. Financial / AI agent builders
2. On-chain treasury and asset-management teams
3. RWA / tokenized-asset operators
4. Wallet and security infrastructure teams

The research focuses on authorization, controls, evidence requirements, auditability, build-vs-buy decisions, and willingness to participate in a shadow-mode pilot.

## Interview Protocol

The interview is implemented as a state machine rather than an unconstrained chatbot.

```text
CONSENT
  ↓
CONTEXT
  ↓
AUTONOMY
  ↓
CURRENT_CONTROLS
  ↓
RISK
  ↓
AUTHORIZATION
  ↓
AUDITABILITY
  ↓
BUILD_VS_BUY
  ↓
VALUECURATOR_REVEAL
  ↓
OBJECTIONS
  ↓
PILOT_INTEREST
  ↓
COMPLETE
```

The LLM may adapt wording and choose bounded follow-up questions, but it must not skip required research objectives or fabricate participant evidence.

### Research Guardrails

Before the ValueCurator reveal, the interviewer should:

- ask about current and past behavior before hypothetical future behavior;
- avoid explaining ValueCurator while discovering the problem;
- avoid suggesting controls before the participant identifies their own concerns;
- distinguish participant statements from model inference;
- keep follow-up questions bounded;
- preserve the source answer behind every extracted finding;
- never invent missing evidence.

## Wallet Authentication

Participation is wallet-gated.

The intended authentication flow uses **Sign-In With Solana (SIWS)** or an equivalent nonce-based signed-message mechanism.

The wallet is used only to authenticate the research session.

**Authentication is not financial authorization.**

The login signature must never be reused as approval for a transaction, mandate, proposal, or other financial action.

Suggested participant-facing copy:

> Connect your wallet to participate. Your wallet is used only to authenticate your research session. No transaction will be created or submitted.

### Data Minimization

Store only what is needed for the research workflow, such as:

- wallet address;
- interview ID;
- consent version;
- interview protocol version;
- prompt version;
- evidence schema version;
- start and completion timestamps;
- interview responses;
- extracted evidence;
- research profile;
- pilot interest.

Do not collect by default:

- wallet balances;
- transaction history;
- token holdings;
- portfolio value;
- inferred private information from wallet activity.

A wallet should normally have one primary interview per interview-protocol version, with support for resuming an incomplete session.

## Evidence Model

Research conclusions must remain traceable to participant responses.

Example:

```json
{
  "finding": "manual_approval",
  "evidence": "Everything goes through our multisig.",
  "source": "answer_04",
  "confidence": 0.96
}
```

Confidence represents extraction confidence, not a scientific probability that the participant's statement is objectively true.

A session may produce structured outcomes such as:

- problem signal;
- current solution;
- required controls;
- authorization model;
- auditability requirements;
- build-vs-buy signal;
- willingness-to-pay signal;
- pilot interest.

## Participant Outputs

### Research Profile

A concise summary derived from the interview, potentially including:

- participant / organization profile;
- autonomy model;
- current authorization process;
- primary concerns;
- current controls;
- control gaps explicitly identified;
- areas worth investigating.

The Research Profile must not present an invented risk score or imply a formal security assessment.

### Authorization Blueprint

A non-binding structured representation of controls described during the interview, for example:

- permitted assets;
- transaction limits;
- market-evidence requirements;
- liquidity requirements;
- human-approval thresholds;
- emergency controls.

The blueprint is a research artifact, **not an executable mandate**.

It should be clearly labeled as generated from interview responses and not as financial, legal, or security advice.

### Design Partner CTA

Participants with relevant needs may opt into a ValueCurator design-partner or shadow-mode pilot.

Shadow mode should validate authorization logic without moving participant capital.

## Voice

Voice is part of the intended interview experience.

Web flow:

```text
Microphone
   ↓
Browser MediaRecorder
   ↓
Audio
   ↓
Speech-to-Text
   ↓
Transcript
   ↓
Interview Engine
   ↓
Evidence Extraction
   ↓
Next Question
```

The interface may allow the participant to confirm or re-record a transcript before submission.

Text-to-speech is not required for the MVP.

## Architecture

The interview logic should remain independent of any single delivery channel.

```text
ValueCurator Web ─────┐
                     │
Telegram (optional) ─┼──> Interview API
                     │        ↓
Future channels ─────┘   Interview Engine
                              ↓
                     Protocol State Machine
                        ↙             ↘
                  LLM Interview   Evidence Extractor
                        ↓             ↓
                      Storage / Research Dataset
                              ↓
                 Profile + Authorization Blueprint
```

### Proposed Repository Structure

```text
src/
├── api/
├── auth/
│   └── solana/
├── interview/
│   ├── engine.ts
│   ├── state-machine.ts
│   ├── session.ts
│   └── follow-up.ts
├── protocols/
│   ├── customer-discovery/
│   │   ├── protocol.ts
│   │   ├── questions.ts
│   │   └── schema.ts
│   └── mandate-elicitation/       # future
├── evidence/
│   ├── extractor.ts
│   ├── schemas.ts
│   └── classification.ts
├── voice/
│   └── transcribe.ts
├── research/
│   ├── hypotheses.ts
│   ├── profile.ts
│   └── authorization-blueprint.ts
├── storage/
│   ├── repository.ts
│   └── database.ts
└── config/

prompts/
├── interviewer.md
├── evidence-extractor.md
└── research-profile.md

docs/
├── INTERVIEW_PROTOCOL.md
├── RESEARCH_HYPOTHESES.md
├── DATA_MODEL.md
└── PRIVACY.md

tests/
```

## Technology Direction

Initial technical direction:

- TypeScript / Node.js
- OpenAI API for bounded interview reasoning and structured extraction
- Zod for runtime schemas and structured outputs
- Solana wallet authentication / SIWS
- browser MediaRecorder for web voice capture
- speech-to-text for transcription
- persistent relational storage
- Vitest for automated tests
- Docker for reproducible deployment
- Telegram adapter as an optional secondary channel

The ValueCurator website can consume this service through an API rather than coupling the interview engine directly to the existing application.

## MVP Scope

### P0 — Required

- Solana wallet connection
- nonce-based signed authentication
- explicit research consent
- text interview
- deterministic interview state machine
- bounded adaptive follow-ups
- persistent/resumable sessions
- evidence extraction with source traceability
- Research Profile
- Authorization Blueprint
- design-partner / shadow-pilot CTA
- JSON/CSV research export
- protocol and prompt versioning

### P1 — Next

- voice input
- transcription confirmation
- researcher review tools
- stronger aggregate research exports

### P2 — Later

- Telegram adapter
- additional interview protocols
- aggregate anonymized benchmarking
- design-partner workflow integrations

## Out of Scope for the MVP

To keep the research instrument focused, the MVP does not require:

- direct trade execution;
- custody;
- private-key management;
- transaction construction;
- automatic mandate activation;
- payments;
- RAG or a vector database;
- multi-agent orchestration;
- complex analytics dashboards;
- text-to-speech;
- portfolio analysis from wallet history;
- direct KAIROS execution integration.

## Research Funnel

At minimum, measure:

```text
Landing
  ↓
Wallet Connected
  ↓
Interview Started
  ↓
Interview Completed
  ↓
Profile Generated
  ↓
Pilot Interest
```

Wallet gating creates intentional identity continuity but may introduce participation friction, so conversion between these stages should be measured.

## Future: Mandate Elicitation

The interview engine is deliberately reusable.

A future protocol can evolve the flow from customer discovery to owner mandate elicitation:

```text
Mandate Interview
      ↓
Structured Intent
      ↓
Draft Mandate
      ↓
Deterministic Validation
      ↓
Simulation
      ↓
Human Review
      ↓
Explicit Approval
      ↓
Deterministic / Executable Policy
```

The critical invariant is that an LLM does **not** directly create executable authority.

It may elicit intent, structure requirements, identify missing thresholds, and generate a draft. Deterministic validation and explicit owner approval remain separate requirements.

## Relationship to ValueCurator

ValueCurator is an evidence-gated authorization layer for autonomous finance on Solana.

The Discovery Agent extends the system upstream: first by learning how real users define autonomy, authorization, evidence, and risk; later by helping owners express those requirements as structured intent.

The architectural boundary remains explicit:

```text
AI conversation
      ↓
Structured evidence / intent
      ↓
Deterministic validation
      ↓
Human authorization
      ↓
ValueCurator / KAIROS controls
```

## Security Principles

- No private keys are collected.
- No seed phrases are requested.
- Wallet login signatures authenticate sessions only.
- No transaction is created as part of authentication.
- LLM output is treated as untrusted structured input until validated.
- Research evidence remains linked to source responses.
- Missing or malformed structured data must fail safely.
- Financial authorization remains outside the Discovery Agent.

## Status

**Early development / customer-discovery MVP.**

This repository defines the initial scope and architecture. Implementation will evolve based on customer interviews and design-partner feedback.

---

**ValueCurator** — Evidence-gated execution for autonomous finance.

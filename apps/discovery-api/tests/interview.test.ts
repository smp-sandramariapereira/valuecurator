import { describe, expect, it } from "vitest";
import { InterviewEngine } from "../src/interview/engine.js";
import { InMemorySessionRepository } from "../src/storage/repository.js";

describe("InterviewEngine", () => {
  it("requires explicit consent", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-test");
    await expect(engine.answer(session.id, "no")).rejects.toThrow("Explicit consent");
  });

  it("advances through the protocol and preserves evidence sources", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-test");
    let view = await engine.answer(session.id, "yes");
    expect(view.session.state).toBe("CONTEXT");

    view = await engine.answer(session.id, "We build an autonomous treasury agent.");
    expect(view.session.state).toBe("AUTONOMY");

    view = await engine.answer(session.id, "Trades require manual approval through a multisig.");
    expect(view.session.state).toBe("CURRENT_CONTROLS");
    expect(view.session.evidence.some((e) => e.finding === "manual_approval" && e.source === "answer_03" && e.sourceState === "AUTONOMY")).toBe(true);
  });

  it("resumes an incomplete session for the same protocol and wallet", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const first = await engine.start("wallet-test");
    const second = await engine.start("wallet-test");
    expect(second.id).toBe(first.id);
  });
  it("does not promote unknown answers into research evidence", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-unknown");
    const answers = [
      "yes",
      "We build a treasury agent.",
      "I don't know",
      "não sei",
      "not sure",
      "I dont know",
      "No idea",
      "unknown",
      "Continue",
      "I don't know",
      "maybe later"
    ];

    let view;
    for (const answer of answers) view = await engine.answer(session.id, answer);

    expect(view?.session.state).toBe("COMPLETE");
    expect(view?.researchProfile.autonomyModel).toEqual([]);
    expect(view?.researchProfile.concerns).toEqual([]);
    expect(view?.researchProfile.authorizationNeeds).toEqual([]);
    expect(view?.researchProfile.buildVsBuySignals).toEqual([]);
    expect(view?.researchProfile.pilotInterest).toBeUndefined();
  });

  it("records pilot interest only when explicitly indicated", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-pilot");
    const answers = ["yes","context","human supervised","multisig","risk","limits","audit trail","buy","continue","objection","yes, I am interested"];
    let view;
    for (const answer of answers) view = await engine.answer(session.id, answer);
    expect(view?.researchProfile.pilotInterest).toBe(true);
  });
  it("keeps research dimensions state-scoped and deduplicated", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-scoped");
    const answers = [
      "yes",
      "We build an autonomous treasury agent.",
      "The agent proposes actions, but a human must approve execution.",
      "Every transaction requires manual approval through a multisig and transaction limits.",
      "Stale market data and excessive price impact concern us.",
      "We require per-transaction limits, daily exposure limits, approved assets, and fresh market evidence.",
      "We need an audit trail showing evidence and policy checks.",
      "We prefer specialized infrastructure.",
      "It fits our workflow.",
      "Security review is required.",
      "Yes, I am interested."
    ];
    let view;
    for (const answer of answers) view = await engine.answer(session.id, answer);

    expect(view?.researchProfile.currentControls).toEqual([
      "Every transaction requires manual approval through a multisig and transaction limits."
    ]);
    expect(view?.researchProfile.authorizationNeeds).toEqual([
      "We require per-transaction limits, daily exposure limits, approved assets, and fresh market evidence."
    ]);
    expect(view?.authorizationBlueprint.requirementsMentioned).toEqual(expect.arrayContaining([
      "manual_approval","transaction_limits","daily_exposure_limit","approved_assets","market_evidence","auditability_requirement"
    ]));
    expect(view?.authorizationBlueprint.missingThresholds).toEqual(expect.arrayContaining([
      "per_transaction_limit","daily_exposure_limit","maximum_evidence_age"
    ]));
  });

  it("distinguishes a named requirement from a quantitative threshold", async () => {
    const engine = new InterviewEngine(new InMemorySessionRepository());
    const session = await engine.start("wallet-threshold");
    const answers = [
      "yes","context","human approval","multisig","risk",
      "Per-transaction limit is $5,000 and daily exposure limit is $20,000. Maximum price impact is 1%.",
      "audit trail","buy","fit","none","no"
    ];
    let view;
    for (const answer of answers) view = await engine.answer(session.id, answer);
    expect(view?.authorizationBlueprint.missingThresholds).not.toContain("per_transaction_limit");
    expect(view?.authorizationBlueprint.missingThresholds).not.toContain("daily_exposure_limit");
    expect(view?.authorizationBlueprint.missingThresholds).not.toContain("maximum_price_impact");
    expect(view?.authorizationBlueprint.missingThresholds).toContain("maximum_evidence_age");
  });
});

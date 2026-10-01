import type { InterviewState, Session } from "../domain.js";
import { isSubstantiveAnswer } from "./profile.js";
import { PROMPT_VERSION, PROTOCOL_VERSION } from "../interview/protocol.js";

export type AudienceSegment = "B2B" | "B2A" | "B2B_AND_B2A" | "UNCLASSIFIED";

type IndicatorSegment = "B2B" | "B2A";

type IndicatorRule = {
  id: string;
  segment: IndicatorSegment;
  label: string;
  states: InterviewState[];
  re: RegExp;
};

export const AUDIENCE_INDICATORS: IndicatorRule[] = [
  {
    id: "allocates_capital",
    segment: "B2B",
    label: "A business allocates capital or runs a treasury, desk, fund, or issuance",
    states: ["CONTEXT", "AUTHORIZATION", "BUILD_VS_BUY"],
    re: /\b(treasury|fund|desk|family office|issuer|our capital|allocat(?:e|es|ing)|company|business|firm)\b/i,
  },
  {
    id: "named_approver",
    segment: "B2B",
    label: "A person in the organization approves before funds move",
    states: ["AUTHORIZATION", "CURRENT_CONTROLS", "AUDITABILITY"],
    re: /\b(treasurer|cfo|committee|approver|second person|our team approves|human approval|manual approval)\b/i,
  },
  {
    id: "pays_for_control",
    segment: "B2B",
    label: "The organization pays another party for a control",
    states: ["BUILD_VS_BUY"],
    re: /\b(pay|paid|vendor|subscription|buy|bought)\b/i,
  },
  {
    id: "operates_agent",
    segment: "B2A",
    label: "An agent, runtime, or bot proposes or carries financial actions",
    states: ["CONTEXT", "AUTONOMY"],
    re: /\b(agent|runtime|bot|autonomous system)\b/i,
  },
  {
    id: "proposes_without_custody",
    segment: "B2A",
    label: "The agent drafts or proposes an action and does not itself approve it",
    states: ["AUTONOMY", "CONTEXT"],
    re: /\b(propos(?:e|es|ed|al)|draft(?:s|ed)?|recommend(?:s|ed)?)\b/i,
  },
  {
    id: "acts_for_principal",
    segment: "B2A",
    label: "The agent acts for a client, owner, or other principal",
    states: ["CONTEXT", "AUTONOMY", "AUTHORIZATION"],
    re: /\b(on behalf|for a client|for the owner|principal|customer funds)\b/i,
  },
];

export type MatchedIndicator = {
  id: string;
  segment: IndicatorSegment;
  label: string;
  quote: string;
};

export type SessionAudience = {
  segment: AudienceSegment;
  possibleUser: string;
  matchedIndicators: MatchedIndicator[];
};

const POSSIBLE_USER: Record<AudienceSegment, string> = {
  B2B: "Possible user: the business that sets the mandate and keeps custody.",
  B2A: "Possible user: the agent operator that proposes actions under that mandate.",
  B2B_AND_B2A: "Possible users: the business that owns the capital and the agent that acts for it.",
  UNCLASSIFIED: "No B2B or B2A indicator in the substantive answers.",
};

export function classifySession(session: Session): SessionAudience {
  const matchedIndicators = AUDIENCE_INDICATORS.flatMap((rule) => {
    const answer = session.answers.find(
      (item) =>
        rule.states.includes(item.state) &&
        isSubstantiveAnswer(item.rawAnswer) &&
        rule.re.test(item.rawAnswer),
    );
    if (!answer) return [];
    return [{
      id: rule.id,
      segment: rule.segment,
      label: rule.label,
      quote: answer.rawAnswer.slice(0, 180),
    }];
  });

  const b2b = matchedIndicators.some((item) => item.segment === "B2B");
  const b2a = matchedIndicators.some((item) => item.segment === "B2A");
  const segment: AudienceSegment = b2b && b2a ? "B2B_AND_B2A" : b2b ? "B2B" : b2a ? "B2A" : "UNCLASSIFIED";

  return {
    segment,
    possibleUser: POSSIBLE_USER[segment],
    matchedIndicators,
  };
}

export type JudgeAnalysis = {
  protocolVersion: string;
  promptVersion: string;
  disclaimer: string;
  segments: Array<{ id: "B2B" | "B2A"; label: string; definition: string }>;
  indicators: Array<{ id: string; segment: IndicatorSegment; label: string }>;
  summary: {
    consented: number;
    completed: number;
    inProgress: number;
    b2b: number;
    b2a: number;
    both: number;
    unclassified: number;
    pilotYes: number;
    pilotNo: number;
  };
  sessions: Array<{
    interviewId: string;
    wallet: string;
    state: Session["state"];
    completed: boolean;
    segment: AudienceSegment;
    possibleUser: string;
    pilotInterest: boolean | null;
    matchedIndicators: Array<{ id: string; segment: IndicatorSegment; label: string }>;
    blueprintStatus: "NON_BINDING_RESEARCH_ARTIFACT";
  }>;
};

function shortWallet(wallet: string) {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function buildAudienceAnalysis(sessions: Session[]): JudgeAnalysis {
  const consented = sessions.filter((session) => session.consented);
  const rows = consented.map((session) => {
    const audience = classifySession(session);
    return {
      interviewId: session.id,
      wallet: shortWallet(session.walletAddress),
      state: session.state,
      completed: session.state === "COMPLETE",
      segment: audience.segment,
      possibleUser: audience.possibleUser,
      pilotInterest: session.pilotInterest ?? null,
      matchedIndicators: audience.matchedIndicators.map(({ id, segment, label }) => ({ id, segment, label })),
      blueprintStatus: "NON_BINDING_RESEARCH_ARTIFACT" as const,
    };
  });

  const completed = rows.filter((row) => row.completed);

  return {
    protocolVersion: PROTOCOL_VERSION,
    promptVersion: PROMPT_VERSION,
    disclaimer:
      "Everyone can read this panel. The interview text stays with the wallet that signed it. That signature identifies the participant. It does not authorize a transaction and it does not read balances. One wallet registers one interview. Indicators are research signals, not customers and not execution authority.",
    segments: [
      {
        id: "B2B",
        label: "Business",
        definition: "A business that allocates capital, issues an asset, or employs the person who approves a financial action.",
      },
      {
        id: "B2A",
        label: "Agent",
        definition: "An agent, runtime, or operator that proposes or carries a financial action for someone else's capital.",
      },
    ],
    indicators: AUDIENCE_INDICATORS.map(({ id, segment, label }) => ({ id, segment, label })),
    summary: {
      consented: consented.length,
      completed: completed.length,
      inProgress: rows.length - completed.length,
      b2b: completed.filter((row) => row.segment === "B2B").length,
      b2a: completed.filter((row) => row.segment === "B2A").length,
      both: completed.filter((row) => row.segment === "B2B_AND_B2A").length,
      unclassified: completed.filter((row) => row.segment === "UNCLASSIFIED").length,
      pilotYes: completed.filter((row) => row.pilotInterest === true).length,
      pilotNo: completed.filter((row) => row.pilotInterest === false).length,
    },
    sessions: rows,
  };
}

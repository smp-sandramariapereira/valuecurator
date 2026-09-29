import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildCanonicalMandate,
  canonicalMandateJson,
  validateMandateDraft,
  type MandateArtifact,
  type MandateDraft,
} from "@/lib/mandate-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

function isDraft(value: unknown): value is MandateDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Partial<MandateDraft>;
  return typeof draft.maximumTradeUsdc === "number" &&
    typeof draft.maximumDailyUsdc === "number" &&
    typeof draft.maximumAllocationPercent === "number" &&
    typeof draft.maximumPriceAgeSeconds === "number" &&
    typeof draft.maximumConfidenceBps === "number" &&
    typeof draft.maximumDeviationBps === "number" &&
    typeof draft.maximumSlippageBps === "number" &&
    typeof draft.validFrom === "string" &&
    typeof draft.validUntil === "string" &&
    draft.advisorMode === "shadow";
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 16_384) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }
  const body = input as { draft?: unknown; owner?: unknown };
  if (!isDraft(body.draft)) return NextResponse.json({ error: "Invalid mandate fields." }, { status: 400 });
  if (typeof body.owner !== "string" || body.owner.length > 128) {
    return NextResponse.json({ error: "Invalid owner." }, { status: 400 });
  }
  const errors = validateMandateDraft(body.draft);
  if (errors.length) return NextResponse.json({ error: errors.join(" "), errors }, { status: 422 });
  const mandate = buildCanonicalMandate(body.draft, body.owner);
  const mandateHash = createHash("sha256").update(canonicalMandateJson(mandate)).digest("hex");
  const artifact: MandateArtifact = {
    schemaVersion: 1,
    kind: "PROOFGATE_EXECUTION_MANDATE",
    status: "DRAFT",
    mandateId: `mandate_aaplx_${mandateHash.slice(0, 12)}`,
    mandateHash,
    mandate,
    attestation: null,
    transactionConstructed: false,
    transactionSubmitted: false,
  };
  return NextResponse.json({ artifact }, { headers: { "Cache-Control": "no-store" } });
}

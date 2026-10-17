import { NextRequest, NextResponse } from "next/server";
import { entitlementHttp } from "@/lib/oracle-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const result = entitlementHttp({
    authorization: request.headers.get("authorization"),
    serverToken: process.env.KAIROS_ENTITLEMENTS_TOKEN?.trim(),
    serverPlanId: process.env.KAIROS_SUBSCRIPTION_PLAN?.trim() || "basic",
    body: typeof body === "object" && body ? body as { planId?: unknown; providerId?: unknown; requestId?: unknown } : {},
  });
  return NextResponse.json(result.body, { status: result.status });
}

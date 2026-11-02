import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin } from "@valuecurator/proofgate-authorization-service/environment";
import { openLabGateway } from "@valuecurator/proofgate-authorization-service/node";
import { assetCatalog } from "@/lib/asset-registry";

const researchAssets = assetCatalog.map((asset) => ({
  assetId: asset.assetId,
  ticker: asset.ticker,
  displayName: asset.displayName,
}));

export function openLocalLab(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!assertSameOrigin(origin, request.nextUrl.host)) {
    return { error: NextResponse.json({ error: "Cross-origin request rejected.", decision: "ERROR" }, { status: 403 }) };
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 8_192) {
    return { error: NextResponse.json({ error: "Request is too large.", decision: "ERROR" }, { status: 413 }) };
  }
  const opened = openLabGateway(researchAssets);
  if (!opened.gateway) {
    return { error: NextResponse.json({ error: opened.reason, decision: "ERROR", confirmed: false }, { status: 503 }) };
  }
  return { gateway: opened.gateway, host: request.nextUrl.host, bytes: length };
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

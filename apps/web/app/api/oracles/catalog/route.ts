import { NextRequest, NextResponse } from "next/server";
import { oracleCatalog } from "@/lib/oracle-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expectedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (!expectedHost) return false;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export function GET(request: NextRequest): NextResponse {
  if (!sameOrigin(request)) return NextResponse.json({ error: "cross-origin catalog requests are rejected" }, { status: 403 });
  return NextResponse.json(oracleCatalog());
}

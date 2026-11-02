import { NextResponse, type NextRequest } from "next/server";
import { openLocalLab, readJson } from "@/lib/lab-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const opened = openLocalLab(request);
  if ("error" in opened && opened.error) return opened.error;
  const body = await readJson(request);
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const result = await opened.gateway.reconcile({
    signature: String(record.signature ?? ""),
    receiptAddress: String(record.receiptAddress ?? ""),
    authorizationDigest: String(record.authorizationDigest ?? ""),
  });
  return NextResponse.json(result, { status: result.confirmed ? 200 : 409 });
}

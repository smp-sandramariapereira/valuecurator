import { NextResponse, type NextRequest } from "next/server";
import { openLocalLab, readJson } from "@/lib/lab-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const opened = openLocalLab(request);
  if ("error" in opened && opened.error) return opened.error;
  const body = await readJson(request);
  const owner = body && typeof body === "object" && "owner" in body ? String((body as { owner: unknown }).owner) : "";
  const issued = opened.gateway.challenge({ owner, host: opened.host });
  if (!issued.ok) return NextResponse.json({ error: issued.error, decision: "ERROR" }, { status: issued.status ?? 400 });
  return NextResponse.json({ nonce: issued.nonce, expiresAt: issued.expiresAt, message: issued.message, domain: issued.domain });
}

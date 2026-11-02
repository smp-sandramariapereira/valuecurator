import { NextResponse, type NextRequest } from "next/server";
import { openLocalLab, readJson } from "@/lib/lab-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const opened = openLocalLab(request);
  if ("error" in opened && opened.error) return opened.error;
  const body = await readJson(request);
  const result = await opened.gateway.authorize({ host: opened.host, body, bytes: opened.bytes });
  const status = result.status === 413 || result.status === 429 ? result.status : result.decision === "ERROR" ? 503 : 200;
  return NextResponse.json(result, { status });
}

import { NextResponse, type NextRequest } from "next/server";
import { openLocalLab, readJson } from "@/lib/lab-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const opened = openLocalLab(request);
  if ("error" in opened && opened.error) return opened.error;
  const body = await readJson(request);
  const result = await opened.gateway.setup({ host: opened.host, body });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

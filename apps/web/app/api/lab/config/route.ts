import { NextResponse, type NextRequest } from "next/server";
import { openLocalLab } from "@/lib/lab-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const opened = openLocalLab(request);
  if ("error" in opened && opened.error) return opened.error;
  const config = await opened.gateway.getConfig();
  return NextResponse.json(config, { status: config.ok ? 200 : 503 });
}

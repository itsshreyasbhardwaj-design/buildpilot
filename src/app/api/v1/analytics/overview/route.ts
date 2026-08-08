import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { getOverviewStats } from "@/lib/queries/dashboard";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const stats = await getOverviewStats(ctx.organizationId);
  return NextResponse.json(stats);
}

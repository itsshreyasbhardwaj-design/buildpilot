import { NextResponse } from "next/server";
import { getApiContext, unauthorized } from "@/lib/api/context";
import { getRepositories } from "@/lib/queries/dashboard";

export async function GET(request: Request) {
  const ctx = await getApiContext(request);
  if (!ctx) return unauthorized();

  const repositories = await getRepositories(ctx.organizationId);
  return NextResponse.json({ repositories });
}

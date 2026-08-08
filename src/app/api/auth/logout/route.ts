import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/providers/auth/session-token";

export async function POST() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return NextResponse.json({ status: "ok" });
}

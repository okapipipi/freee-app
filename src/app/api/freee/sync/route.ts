import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { syncMasterData } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await syncMasterData();
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[freee sync]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

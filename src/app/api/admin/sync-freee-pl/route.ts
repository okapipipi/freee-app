import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { syncDealsCache, syncTrialPl } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as AuthUser | undefined;
  if (!session || (user?.role !== "admin" && user?.role !== "executive")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dealsResult = await syncDealsCache();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const trialPlResult = await syncTrialPl([currentMonth]);

    return NextResponse.json({ success: true, deals: dealsResult, trialPl: trialPlResult });
  } catch (err: any) {
    console.error("[sync-freee-pl]", err);
    return NextResponse.json(
      { error: err.message ?? "同期に失敗しました" },
      { status: 500 }
    );
  }
}

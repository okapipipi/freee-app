import { NextRequest, NextResponse } from "next/server";
import { syncDealsCache, syncTrialPl } from "@/lib/freee";

export async function GET(request: NextRequest) {
  // Vercel Cron または手動トリガーからの認証チェック
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 取引キャッシュ同期
    const dealsResult = await syncDealsCache();

    // trial_pl 同期（現在月のみ）
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const trialPlResult = await syncTrialPl([currentMonth]);

    return NextResponse.json({
      success: true,
      deals: dealsResult,
      trialPl: trialPlResult,
    });
  } catch (err: any) {
    console.error("sync-pl error:", err);
    return NextResponse.json(
      { error: err.message ?? "同期中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

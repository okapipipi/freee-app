import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { syncTrialPl } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

// 月一覧を生成（例: 2026年なら "2026-01" 〜 "2026-MM" まで）
function getYearMonths(year: number): string[] {
  const now = new Date();
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  return Array.from({ length: maxMonth }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`
  );
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as AuthUser | undefined;
  if (!session || (user?.role !== "admin" && user?.role !== "executive")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const year: number = body.year ?? new Date().getFullYear();
    const monthsOnly: boolean = body.monthsOnly ?? false; // true = 現在月のみ

    const targetMonths = monthsOnly
      ? [`${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`]
      : getYearMonths(year);

    const result = await syncTrialPl(targetMonths);
    return NextResponse.json({ success: true, ...result, targetMonths });
  } catch (err: any) {
    console.error("[sync-trial-pl]", err);
    return NextResponse.json(
      { error: err.message ?? "同期に失敗しました" },
      { status: 500 }
    );
  }
}

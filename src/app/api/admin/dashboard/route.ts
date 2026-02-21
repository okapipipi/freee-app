import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
export interface PlRow {
  department: string;
  accountItem: string;
  partner: string;
  plMonth: string; // YYYY-MM
  amount: number;
}

export interface CfRow {
  dueMonth: string; // YYYY-MM
  partner: string;
  title: string;
  amount: number;
  dueDate: string;
}

export interface RunningRow {
  department: string;
  accountItem: string;
  partner: string;
  title: string;
  costType: string; // running_monthly | running_annual
  amount: number;
  recordingMonth: string; // YYYY-MM
}

export interface DashboardData {
  jitsuPlRows: PlRow[];
  mokuhyoPlRows: PlRow[];
  jitsuCfRows: CfRow[];
  mokuhyoCfRows: CfRow[];
  runningRows: RunningRow[];
  departments: string[];
  availableYears: number[];
  lastPlSyncAt: string | null;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function hasMemoTag(memoTagNames: string | null | undefined, tag: string): boolean {
  if (!memoTagNames) return false;
  return memoTagNames.split(",").map((t) => t.trim()).includes(tag);
}

function getPlMonth(r: {
  category: string;
  usageDate: string | null;
  recordingMonth: string | null;
}): string | null {
  if (r.category === "expense" || r.category === "expense_billable") {
    return r.usageDate ? r.usageDate.substring(0, 7) : null;
  }
  return r.recordingMonth ? r.recordingMonth.substring(0, 7) : null;
}

function getPartnerFromReport(r: {
  category: string;
  billingPartnerName: string | null;
  submitter: { name: string } | null;
}): string {
  if (r.category === "expense" || r.category === "expense_billable") {
    return r.submitter?.name ?? "不明";
  }
  return r.billingPartnerName ?? r.submitter?.name ?? "不明";
}

// ---------------------------------------------------------------------------
// GET ハンドラ
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as AuthUser | undefined;
  if (!session || (user?.role !== "admin" && user?.role !== "executive")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentYear = new Date().getFullYear();
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(currentYear), 10);

  // freee設定（最終同期日時）
  const [freeeConfig] = await db
    .select({ lastPlSyncAt: schema.freeeConfig.lastPlSyncAt })
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));

  // ===== 実績 PL (freeeDealsCache から・「仮」タグなし) =====
  const allDeals = await db.select().from(schema.freeeDealsCache);

  const jitsuPlRows: PlRow[] = [];
  const jitsuCfRows: CfRow[] = [];
  const jitsuYears = new Set<number>();

  for (const deal of allDeals) {
    // 「仮」タグがついているものは実績から除外
    if (hasMemoTag(deal.memoTagNames, "仮")) continue;

    const plMonth = deal.issueDate.substring(0, 7);
    const plYear = parseInt(plMonth.substring(0, 4), 10);
    jitsuYears.add(plYear);

    if (plYear === year) {
      jitsuPlRows.push({
        department: deal.sectionName ?? "未設定",
        accountItem: deal.accountItemName,
        partner: deal.partnerName ?? "不明",
        plMonth,
        amount: deal.amount,
      });
    }

    // CF: dueDate ベース
    if (deal.dueDate) {
      const dueMonth = deal.dueDate.substring(0, 7);
      const dueYear = parseInt(dueMonth.substring(0, 4), 10);
      jitsuYears.add(dueYear);

      if (dueYear === year) {
        jitsuCfRows.push({
          dueMonth,
          partner: deal.partnerName ?? "不明",
          title: deal.accountItemName,
          amount: deal.amount,
          dueDate: deal.dueDate,
        });
      }
    }
  }

  // ===== 目標 PL / CF / ランニングコスト (expenseReport から) =====
  const reports = await db.query.expenseReport.findMany({
    where: (r, { inArray }) =>
      inArray(r.status, ["submitted", "approved", "synced_to_freee"]),
    with: {
      submitter: { columns: { name: true } },
      department: { columns: { name: true } },
    },
  });

  const mokuhyoPlRows: PlRow[] = [];
  const mokuhyoCfRows: CfRow[] = [];
  const runningRows: RunningRow[] = [];
  const mokuhyoYears = new Set<number>();
  const departmentSet = new Set<string>();

  for (const r of reports) {
    // PL 目標
    const plMonth = getPlMonth(r);
    if (plMonth) {
      const plYear = parseInt(plMonth.substring(0, 4), 10);
      mokuhyoYears.add(plYear);

      const deptName = r.department?.name ?? "未設定";
      departmentSet.add(deptName);

      if (plYear === year) {
        mokuhyoPlRows.push({
          department: deptName,
          accountItem: r.accountItemName ?? "未設定",
          partner: getPartnerFromReport(r),
          plMonth,
          amount: r.amount,
        });
      }
    }

    // CF 目標
    const cfDate = r.dueDate ?? r.paymentMonth;
    if (cfDate) {
      const dueMonth = cfDate.substring(0, 7);
      const dueYear = parseInt(dueMonth.substring(0, 4), 10);
      mokuhyoYears.add(dueYear);

      if (dueYear === year) {
        mokuhyoCfRows.push({
          dueMonth,
          partner: getPartnerFromReport(r),
          title: r.title,
          amount: r.amount,
          dueDate: cfDate,
        });
      }
    }

    // ランニングコスト（月額・年間費用）
    if (
      (r.category === "sga" || r.category === "sga_billable") &&
      (r.costType === "running_monthly" || r.costType === "running_annual")
    ) {
      const rm = getPlMonth(r);
      if (rm) {
        const ry = parseInt(rm.substring(0, 4), 10);
        if (ry === year) {
          runningRows.push({
            department: r.department?.name ?? "未設定",
            accountItem: r.accountItemName ?? "未設定",
            partner: getPartnerFromReport(r),
            title: r.title,
            costType: r.costType,
            amount: r.amount,
            recordingMonth: rm,
          });
        }
      }
    }
  }

  // 利用可能な年度一覧（実績・目標の両方を含む）
  const allYears = new Set([...jitsuYears, ...mokuhyoYears, currentYear]);
  const availableYears = Array.from(allYears).sort((a, b) => b - a);

  // 部門一覧（目標データから抽出）
  const departments = Array.from(departmentSet).sort();

  return NextResponse.json({
    jitsuPlRows,
    mokuhyoPlRows,
    jitsuCfRows,
    mokuhyoCfRows,
    runningRows,
    departments,
    availableYears,
    lastPlSyncAt: freeeConfig?.lastPlSyncAt
      ? freeeConfig.lastPlSyncAt.toISOString()
      : null,
  } satisfies DashboardData);
}

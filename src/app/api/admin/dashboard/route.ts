import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { inArray } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as AuthUser | undefined;
  if (!session || (user?.role !== "admin" && user?.role !== "executive")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentYear = new Date().getFullYear();
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") ?? String(currentYear), 10);

  const reports = await db.query.expenseReport.findMany({
    where: (r, { inArray }) =>
      inArray(r.status, ["approved", "synced_to_freee"]),
    with: {
      submitter: { columns: { name: true } },
      department: { columns: { name: true } },
    },
  });

  function getPlMonth(r: {
    category: string;
    usageDate: string | null;
    recordingMonth: string | null;
  }): string | null {
    const cat = r.category;
    if (cat === "expense" || cat === "expense_billable") {
      if (!r.usageDate) return null;
      return r.usageDate.substring(0, 7);
    } else {
      if (!r.recordingMonth) return null;
      return r.recordingMonth.substring(0, 7);
    }
  }

  function getPartner(r: {
    category: string;
    billingPartnerName: string | null;
    submitter: { name: string } | null;
  }): string {
    const cat = r.category;
    if (cat === "expense" || cat === "expense_billable") {
      return r.submitter?.name ?? "不明";
    }
    if (r.billingPartnerName) return r.billingPartnerName;
    return r.submitter?.name ?? "不明";
  }

  const allYears = new Set<number>();
  for (const r of reports) {
    const plMonth = getPlMonth(r);
    if (plMonth) {
      const y = parseInt(plMonth.substring(0, 4), 10);
      if (!isNaN(y)) allYears.add(y);
    }
    if (r.dueDate) {
      const y = parseInt(r.dueDate.substring(0, 4), 10);
      if (!isNaN(y)) allYears.add(y);
    }
  }
  const availableYears = Array.from(allYears).sort((a, b) => b - a);

  const plRows: Array<{
    department: string;
    accountItem: string;
    partner: string;
    plMonth: string;
    amount: number;
    category: string;
  }> = [];

  for (const r of reports) {
    const plMonth = getPlMonth(r);
    if (!plMonth) continue;
    const rowYear = parseInt(plMonth.substring(0, 4), 10);
    if (rowYear !== year) continue;

    plRows.push({
      department: r.department?.name ?? "未設定",
      accountItem: r.accountItemName ?? "未設定",
      partner: getPartner(r),
      plMonth,
      amount: r.amount,
      category: r.category,
    });
  }

  const cfRows: Array<{
    dueMonth: string;
    employee: string;
    title: string;
    amount: number;
    dueDate: string;
    category: string;
  }> = [];

  for (const r of reports) {
    if (!r.dueDate) continue;
    const dueMonth = r.dueDate.substring(0, 7);
    const rowYear = parseInt(dueMonth.substring(0, 4), 10);
    if (rowYear !== year) continue;

    cfRows.push({
      dueMonth,
      employee: r.submitter?.name ?? "不明",
      title: r.title,
      amount: r.amount,
      dueDate: r.dueDate,
      category: r.category,
    });
  }

  return NextResponse.json({ plRows, cfRows, availableYears });
}

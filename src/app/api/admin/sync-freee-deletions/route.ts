import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { dealExists } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.companyId || !config.accessToken) {
    return NextResponse.json({ error: "freeeに接続されていません" }, { status: 503 });
  }

  const reports = await db
    .select({
      id:        schema.expenseReport.id,
      freeDealId: schema.expenseReport.freeDealId,
      title:     schema.expenseReport.title,
    })
    .from(schema.expenseReport)
    .where(
      and(
        eq(schema.expenseReport.status, "synced_to_freee"),
        isNotNull(schema.expenseReport.freeDealId)
      )
    );

  let deletedCount = 0;
  const deletedTitles: string[] = [];

  for (const report of reports) {
    try {
      const exists = await dealExists(config.companyId, report.freeDealId!);
      if (!exists) {
        await db
          .update(schema.expenseReport)
          .set({ status: "freee_deleted", updatedAt: new Date() })
          .where(eq(schema.expenseReport.id, report.id));
        deletedCount++;
        deletedTitles.push(report.title);
      }
    } catch (err) {
      console.warn(`[sync-freee-deletions] スキップ: ${report.title}`, err);
    }
  }

  return NextResponse.json({
    checked: reports.length,
    deleted: deletedCount,
    titles:  deletedTitles,
  });
}

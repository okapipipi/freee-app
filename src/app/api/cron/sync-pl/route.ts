import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "@/lib/freee";

const FREEE_API_BASE = "https://api.freee.co.jp";

export async function GET(request: NextRequest) {
  // Vercel Cron または手動トリガーからの認証チェック
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // freee設定を取得
    const [config] = await db
      .select()
      .from(schema.freeeConfig)
      .where(eq(schema.freeeConfig.id, "singleton"));

    if (!config?.companyId) {
      return NextResponse.json(
        { error: "freee事業所IDが設定されていません" },
        { status: 400 }
      );
    }

    const cid = config.companyId;
    const token = await getValidAccessToken();

    // メモタグID→名前のマップを作成
    const memoTags = await db.select().from(schema.memoTagCache);
    const tagIdToName = new Map<number, string>(
      memoTags.map((t) => [t.freeeId, t.name])
    );

    // freee取引一覧をページネーションで全件取得
    const allDeals: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const params = new URLSearchParams({
        company_id: String(cid),
        type: "expense",
        limit: String(limit),
        offset: String(offset),
      });

      const res = await fetch(
        `${FREEE_API_BASE}/api/1/deals?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`freee API error: ${res.status} ${err}`);
      }

      const data = await res.json();
      const deals: any[] = data.deals ?? [];
      allDeals.push(...deals);

      if (deals.length < limit) break;
      offset += limit;
    }

    // freeeDealsCache を全件入れ替え
    const now = new Date();
    const rows: (typeof schema.freeeDealsCache.$inferInsert)[] = [];

    for (const deal of allDeals) {
      // 各明細行ごとにレコードを作成
      const details: any[] = deal.details ?? [];
      if (details.length === 0) continue;

      for (const detail of details) {
        // メモタグ名を解決
        const tagIds: number[] = detail.tag_ids ?? [];
        const tagNames = tagIds
          .map((id) => tagIdToName.get(id))
          .filter(Boolean) as string[];

        rows.push({
          id: crypto.randomUUID(),
          freeeDealId: deal.id,
          issueDate: deal.issue_date,
          dueDate: deal.due_date ?? null,
          partnerName: deal.partner_name ?? null,
          sectionName: detail.section_name ?? null,
          accountItemName: detail.account_item_name ?? "不明",
          amount: Math.abs(detail.amount ?? 0),
          memoTagNames: tagNames.length > 0 ? tagNames.join(",") : null,
          syncedAt: now,
        });
      }
    }

    // 全件削除して再挿入
    await db.delete(schema.freeeDealsCache);
    if (rows.length > 0) {
      // 500件ずつバッチ挿入
      for (let i = 0; i < rows.length; i += 500) {
        await db.insert(schema.freeeDealsCache).values(rows.slice(i, i + 500));
      }
    }

    // 最終同期日時を更新
    await db
      .update(schema.freeeConfig)
      .set({ lastPlSyncAt: now, updatedAt: now })
      .where(eq(schema.freeeConfig.id, "singleton"));

    return NextResponse.json({
      success: true,
      dealsCount: allDeals.length,
      rowsCount: rows.length,
      syncedAt: now.toISOString(),
    });
  } catch (err: any) {
    console.error("sync-pl error:", err);
    return NextResponse.json(
      { error: err.message ?? "同期中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

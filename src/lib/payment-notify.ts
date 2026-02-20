import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, like, asc } from "drizzle-orm";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const CATEGORY_LABELS: Record<string, string> = {
  sga:              "販管費",
  sga_billable:     "販管費（取引先請求予定）",
  expense:          "立替経費",
  expense_billable: "立替経費（取引先請求予定）",
};

function fmt(n: number) {
  return "¥" + n.toLocaleString("ja-JP");
}

/** 日本時間 YYYY-MM-DD を返す */
function todayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

function formatDateJP(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

// 12:59 に集計したデータを一時保持するメモリキャッシュ
type CachedReport = {
  title:    string;
  category: string;
  amount:   number;
};
type CacheEntry = {
  date:    string; // YYYY-MM-DD
  byUser:  Map<string, { name: string; email: string; reports: CachedReport[] }>;
};

let cache: CacheEntry | null = null;

/**
 * 12:59 に呼ばれる集計処理。
 * freee連携済み・メモタグ「給与振込確認用」・支払期日が当日の取引を取得してキャッシュする。
 */
export async function collectPaymentData(): Promise<void> {
  const today = todayJST();

  const reports = await db.query.expenseReport.findMany({
    where: (r, { eq, and, like }) => and(
      eq(r.dueDate, today),
      eq(r.status, "synced_to_freee"),
      like(r.memoTagNames, "%給与振込確認用%"),
    ),
    with: {
      submitter: { columns: { name: true, email: true } },
    },
    orderBy: (r, { asc }) => [asc(r.createdAt)],
  });

  const byUser = new Map<string, { name: string; email: string; reports: CachedReport[] }>();

  for (const r of reports) {
    if (!r.submitter?.email) continue;
    const key = r.submitter.email;
    if (!byUser.has(key)) {
      byUser.set(key, { name: r.submitter.name, email: r.submitter.email, reports: [] });
    }
    byUser.get(key)!.reports.push({
      title:    r.title,
      category: r.category,
      amount:   r.amount,
    });
  }

  cache = { date: today, byUser };
  console.log(`[payment-notify] 集計完了: ${today} / ${byUser.size}名 / ${reports.length}件`);
}

/**
 * 13:00 に呼ばれる送信処理。
 * collectPaymentData() のキャッシュを使ってメール送信する。
 */
export async function sendPaymentNotifications(): Promise<void> {
  const today = todayJST();

  if (!cache || cache.date !== today) {
    // キャッシュがない場合はその場で集計してから送信
    console.log("[payment-notify] キャッシュなし。その場で集計します。");
    await collectPaymentData();
  }

  if (!cache || cache.byUser.size === 0) {
    console.log(`[payment-notify] ${today}: 対象の経費なし`);
    cache = null;
    return;
  }

  const resend = getResend();

  for (const { name, email, reports } of cache.byUser.values()) {
    const total = reports.reduce((s, r) => s + r.amount, 0);
    const html  = buildHtml({ userName: name, today, reports, total });

    try {
      await resend.emails.send({
        from:    "DigiMan 経費・販管費申請システム <onboarding@resend.dev>",
        to:      email,
        subject: `【経費支払い通知】${formatDateJP(today)} お支払い経費のご確認（${fmt(total)}）`,
        html,
      });
      console.log(`[payment-notify] 送信完了 → ${email} (${reports.length}件 ${fmt(total)})`);
    } catch (err) {
      console.error(`[payment-notify] 送信失敗 → ${email}`, err);
    }
  }

  cache = null; // 送信後にキャッシュをクリア
}

// ─── HTML メール本文 ──────────────────────────────────────────────────────────

function buildHtml(params: {
  userName: string;
  today:    string;
  reports:  CachedReport[];
  total:    number;
}): string {
  const { userName, today, reports, total } = params;

  const rows = reports
    .map(
      (r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${CATEGORY_LABELS[r.category] ?? r.category}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;">${fmt(r.amount)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="background:#1e40af;padding:20px 24px;">
      <p style="color:#fff;margin:0;font-size:14px;font-weight:600;">経費管理システム</p>
    </div>
    <div style="padding:24px;">
      <h2 style="font-size:18px;margin:0 0 8px;">経費お支払い通知</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">${formatDateJP(today)}</p>

      <p style="font-size:14px;margin:0 0 16px;">${userName} 様</p>
      <p style="font-size:14px;margin:0 0 20px;">
        本日（${formatDateJP(today)}）を支払期日とする以下の経費をお支払いしました。
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">件名</th>
            <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">種別</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">金額</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td colspan="2" style="padding:10px 12px;font-weight:700;font-size:15px;">合計</td>
            <td style="padding:10px 12px;font-weight:700;font-size:15px;text-align:right;font-family:monospace;">${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="font-size:13px;color:#6b7280;margin:0;">
        ご不明点は岡部（経理）までご連絡ください。
      </p>
    </div>
  </div>
</body>
</html>`;
}

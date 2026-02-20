import { Resend } from "resend";

const ADMIN_EMAIL = "r.okabe@digi-man.com";

const CATEGORY_LABEL: Record<string, string> = {
  expense:          "経費申請",
  expense_billable: "経費申請（請求あり）",
  sga:              "販管費申請",
  sga_billable:     "販管費申請（請求あり）",
};

/** 申請提出時に管理者へ通知メールを送信する */
export async function sendSubmissionNotification({
  submitterName,
  title,
  amount,
  category,
  reportId,
}: {
  submitterName: string;
  title: string;
  amount: number;
  category: string;
  reportId: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const amountStr = amount.toLocaleString("ja-JP");

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#111827;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">DigiMan 経費・販管費申請システム</h1>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:13px;">申請通知</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:15px;color:#374151;">新しい申請が提出されました。</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="border-collapse:collapse;font-size:13px;width:100%;">
          <tr>
            <td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;">申請者</td>
            <td style="padding:6px 0;color:#111827;font-weight:600;">${submitterName}</td>
          </tr>
          <tr>
            <td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;">種別</td>
            <td style="padding:6px 0;color:#111827;font-weight:600;">${categoryLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;">件名</td>
            <td style="padding:6px 0;color:#111827;">${title}</td>
          </tr>
          <tr>
            <td style="padding:6px 16px 6px 0;color:#6b7280;white-space:nowrap;">金額</td>
            <td style="padding:6px 0;color:#111827;font-weight:600;">¥${amountStr}</td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;">
        <a href="${appUrl}/admin/reports"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
          申請を確認する
        </a>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">このメールはDigiMan管理者向けの自動通知です。</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await resend.emails.send({
    from: "DigiMan 経費・販管費申請システム <onboarding@resend.dev>",
    to: ADMIN_EMAIL,
    subject: `【DigiMan】新しい申請: ${submitterName}さんから${categoryLabel}`,
    html,
  });
}

/** 社員招待メールを送信する */
export async function sendInvitationEmail({
  to,
  name,
  email,
  password,
}: {
  to: string;
  name: string;
  email: string;
  password: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const html = `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- ヘッダー -->
    <div style="background:#111827;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">
        DigiMan 経費・販管費申請システム
      </h1>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:13px;">社内経費・販管費管理プラットフォーム</p>
    </div>

    <!-- 本文 -->
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:15px;color:#374151;">${name} さん</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;">
        DigiMan 経費・販管費申請システムへご招待します。<br>
        以下のログイン情報でシステムにアクセスしてください。
      </p>

      <!-- アプリ紹介 -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">このシステムでできること</h2>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.9;">
          <li><strong>経費の申請</strong>　利用日・金額・領収書をまとめて提出</li>
          <li><strong>販管費の申請</strong>　月額・年間・単発の費用を申請・管理</li>
          <li><strong>申請状況の確認</strong>　提出した申請の承認状況をリアルタイムで確認</li>
          <li><strong>領収書・証憑のアップロード</strong>　スマホ撮影した画像をそのまま添付</li>
        </ul>
      </div>

      <!-- ログイン情報 -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h2 style="margin:0 0 14px;font-size:14px;font-weight:700;color:#1d4ed8;">ログイン情報</h2>
        <table style="border-collapse:collapse;font-size:13px;width:100%;">
          <tr>
            <td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;">メールアドレス</td>
            <td style="padding:4px 0;color:#111827;font-weight:600;">${email}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;">初期パスワード</td>
            <td style="padding:4px 0;color:#111827;font-weight:600;font-family:monospace;">${password}</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#f59e0b;font-weight:600;">
        ⚠ 初回ログイン後、必ずパスワードを変更してください。
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
        ログイン後に自動でパスワード変更画面が表示されます。
      </p>

      <!-- ログインボタン -->
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${appUrl}/login"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
          システムにログインする
        </a>
      </div>
    </div>

    <!-- フッター -->
    <div style="padding:20px 32px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        このメールはDigiMan管理者から送信されています。<br>
        心当たりがない場合は、このメールを無視してください。
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();

  await resend.emails.send({
    from: "DigiMan 経費・販管費申請システム <onboarding@resend.dev>",
    to,
    subject: "【DigiMan】経費・販管費申請システムへのご招待",
    html,
  });
}

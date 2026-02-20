export async function register() {
  // Node.js ランタイム（サーバー側）でのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = (await import("node-cron")).default;
    const { collectPaymentData, sendPaymentNotifications } = await import("./lib/payment-notify");

    // 12:59 に freee連携済み・支払期日当日の経費を集計
    cron.schedule(
      "59 12 * * *",
      async () => {
        console.log("[cron] 支払期日通知：集計開始");
        await collectPaymentData();
      },
      { timezone: "Asia/Tokyo" }
    );

    // 13:00 に集計済みデータを各申請者へメール送信
    cron.schedule(
      "0 13 * * *",
      async () => {
        console.log("[cron] 支払期日通知：メール送信開始");
        await sendPaymentNotifications();
      },
      { timezone: "Asia/Tokyo" }
    );

    console.log("[cron] 支払期日通知スケジュール登録完了（集計 12:59 / 送信 13:00 JST）");
  }
}

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { sendInvitationEmail } from "../src/lib/mailer";

async function main() {
  try {
    await sendInvitationEmail({
      to:       "r.okabe@digi-man.com",
      name:     "岡部りさ",
      email:    "r.okabe@digi-man.com",
      password: "digiman1007",
    });
    console.log("✓ 招待メール送信完了: r.okabe@digi-man.com");
  } catch (e) {
    console.error("✗ 送信失敗:", e);
    process.exit(1);
  }
}

main();

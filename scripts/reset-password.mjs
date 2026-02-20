import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { hashSync } from "bcryptjs";

const envContent = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const client = createClient({
  url: env["TURSO_DATABASE_URL"],
  authToken: env["TURSO_AUTH_TOKEN"],
});

const email = "r.okabe@digi-man.com";
const newPassword = "Aki08050805";
const hash = hashSync(newPassword, 10);

// ユーザーID取得
const userRes = await client.execute({
  sql: "SELECT id FROM user WHERE email = ?",
  args: [email],
});

if (userRes.rows.length === 0) {
  console.error("ユーザーが見つかりません:", email);
  process.exit(1);
}

const userId = userRes.rows[0].id;
console.log("ユーザーID:", userId);

// accountテーブルのパスワードを更新
const result = await client.execute({
  sql: "UPDATE account SET password = ? WHERE userId = ? AND providerId = 'credential'",
  args: [hash, userId],
});

console.log("更新件数:", result.rowsAffected);
console.log("パスワードを Aki08050805 に設定しました");

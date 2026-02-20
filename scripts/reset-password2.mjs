/**
 * BetterAuthと同じscrypt形式でパスワードハッシュを生成してTursoに書き込む
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { scryptAsync } from "@noble/hashes/scrypt";
import { hex } from "@better-auth/utils/hex";

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

// BetterAuthと同じscryptパラメータ
async function hashPassword(password) {
  const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)));
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${hex.encode(key)}`;
}

const email    = "r.okabe@digi-man.com";
const password = "Aki08050805";

const hash = await hashPassword(password);
console.log("生成したハッシュ:", hash.slice(0, 20) + "...");

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

// accountテーブルを更新
const result = await client.execute({
  sql: "UPDATE account SET password = ? WHERE userId = ? AND providerId = 'credential'",
  args: [hash, userId],
});

console.log("更新件数:", result.rowsAffected);
console.log("パスワードを正しい形式で設定しました:", email);

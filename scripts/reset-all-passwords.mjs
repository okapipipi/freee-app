/**
 * 全ユーザーのパスワードをBetterAuth(scrypt)形式で更新
 * - admin:    Aki08050805（岡部さん - 既に更新済みだが念のため）
 * - employee: digiman0805
 * - executive: aaa
 * - intern:   digiman0805（社員と同じ）
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

async function hashPassword(password) {
  const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)));
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${hex.encode(key)}`;
}

const rolePasswords = {
  admin:     null,          // 岡部さんは既に更新済みのためスキップ
  employee:  "digiman1007",
  executive: "digiman0805",
  intern:    "digiman1007",
};

// 全ユーザー取得
const usersRes = await client.execute("SELECT id, email, role FROM user");
const users = usersRes.rows;
console.log(`ユーザー数: ${users.length} 件\n`);

let updated = 0;
let skipped = 0;

for (const user of users) {
  const password = rolePasswords[user.role];
  if (!password) {
    console.log(`  スキップ (role不明): ${user.email} [${user.role}]`);
    skipped++;
    continue;
  }

  const hash = await hashPassword(password);
  const result = await client.execute({
    sql: "UPDATE account SET password = ? WHERE userId = ? AND providerId = 'credential'",
    args: [hash, user.id],
  });

  if (result.rowsAffected > 0) {
    console.log(`  ✓ ${user.email} [${user.role}]`);
    updated++;
  } else {
    // accountレコードがない場合は挿入
    const { randomUUID } = await import("crypto");
    await client.execute({
      sql: `INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
            VALUES (?,?,?,?,?,?,?)`,
      args: [randomUUID(), user.id, "credential", user.id, hash,
             Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)],
    });
    console.log(`  ✓ ${user.email} [${user.role}] (新規account作成)`);
    updated++;
  }
}

console.log(`\n完了: ${updated} 件更新, ${skipped} 件スキップ`);

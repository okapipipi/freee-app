/**
 * ローカルSQLite (dev.db) → Turso 移行スクリプト
 * 実行: node scripts/migrate-to-turso.mjs
 */

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// .env.local を読み込む
const envContent = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  env[key] = val;
}

const TURSO_URL   = env["TURSO_DATABASE_URL"];
const TURSO_TOKEN = env["TURSO_AUTH_TOKEN"];

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN が .env.local に見つかりません");
  process.exit(1);
}

// ISO文字列 → Unix秒（null許容）
function toUnix(isoStr) {
  if (!isoStr) return null;
  return Math.floor(new Date(isoStr).getTime() / 1000);
}

// bool → 0/1
function toInt(v) {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}

const src  = new Database("./dev.db");
const dest = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function run() {
  console.log("=== Turso 移行スクリプト開始 ===\n");

  // ---------- 1. department ----------
  const departments = src.prepare("SELECT * FROM Department").all();
  console.log(`Department: ${departments.length} 件`);
  for (const d of departments) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO department (id, name, freeeSectionId, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
      args: [d.id, d.name, d.freeeSectionId ?? null, toUnix(d.createdAt), toUnix(d.updatedAt)],
    });
  }
  console.log("  → department 完了");

  // ---------- 2. user + account ----------
  const users = src.prepare("SELECT * FROM User").all();
  console.log(`\nUser: ${users.length} 件`);
  const now = Math.floor(Date.now() / 1000);
  for (const u of users) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO user
        (id, name, email, emailVerified, image, createdAt, updatedAt,
         role, departmentId, freeePartnerId, isActive, isHidden,
         mustChangePassword, sortOrder, invitedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        u.id, u.name, u.email,
        0,       // emailVerified
        null,    // image
        toUnix(u.createdAt), toUnix(u.updatedAt),
        u.role, u.departmentId ?? null, u.freeePartnerId ?? null,
        toInt(u.isActive), toInt(u.isHidden),
        toInt(u.mustChangePassword), u.sortOrder,
        toUnix(u.invitedAt),
      ],
    });

    // accountテーブルに認証情報を移行（BetterAuthのcredentialプロバイダー）
    await dest.execute({
      sql: `INSERT OR REPLACE INTO account
        (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?,?)`,
      args: [
        randomUUID(), u.id, "credential", u.id,
        u.passwordHash,
        toUnix(u.createdAt), now,
      ],
    });
  }
  console.log("  → user + account 完了");

  // ---------- 3. expenseReport ----------
  const reports = src.prepare("SELECT * FROM ExpenseReport").all();
  console.log(`\nExpenseReport: ${reports.length} 件`);
  for (const r of reports) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO expenseReport
        (id, submitterId, title, description, amount, category, costType, taxType,
         paymentMethod, costEndDate, hasReceipt, supervisorName,
         billingPartnerName, billingPartnerId, usageDate, dueDate,
         recordingMonth, paymentMonth, status, isActual,
         accountItemId, accountItemName, departmentId, adminMemo,
         syncDescription, isQualifiedInvoice, memoTagNames,
         freeDealId, freeePartnerId, freeeSyncedAt, freeeSyncError,
         source, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        r.id, r.submitterId ?? null, r.title, r.description, r.amount,
        r.category, r.costType, r.taxType,
        r.paymentMethod ?? null, r.costEndDate ?? null,
        toInt(r.hasReceipt), r.supervisorName ?? null,
        r.billingPartnerName ?? null, r.billingPartnerId ?? null,
        r.usageDate ?? null, r.dueDate ?? null,
        r.recordingMonth ?? null, r.paymentMonth ?? null,
        r.status, toInt(r.isActual),
        r.accountItemId ?? null, r.accountItemName ?? null,
        r.departmentId ?? null, r.adminMemo ?? null,
        toInt(r.syncDescription), toInt(r.isQualifiedInvoice),
        r.memoTagNames ?? null,
        r.freeDealId ?? null, r.freeePartnerId ?? null,
        toUnix(r.freeeSyncedAt), r.freeeSyncError ?? null,
        r.source, toUnix(r.createdAt), toUnix(r.updatedAt),
      ],
    });
  }
  console.log("  → expenseReport 完了");

  // ---------- 4. attachment ----------
  const attachments = src.prepare("SELECT * FROM Attachment").all();
  console.log(`\nAttachment: ${attachments.length} 件`);
  for (const a of attachments) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO attachment
        (id, reportId, fileName, filePath, mimeType, fileSize, freeeReceiptId, createdAt)
        VALUES (?,?,?,?,?,?,?,?)`,
      args: [
        a.id, a.reportId, a.fileName, a.filePath, a.mimeType, a.fileSize,
        a.freeeReceiptId ?? null, toUnix(a.createdAt),
      ],
    });
  }
  console.log("  → attachment 完了");

  // ---------- 5. freeeConfig ----------
  const configs = src.prepare("SELECT * FROM FreeeConfig").all();
  console.log(`\nFreeeConfig: ${configs.length} 件`);
  for (const c of configs) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO freeeConfig
        (id, companyId, accessToken, refreshToken, tokenExpiresAt, lastSyncAt, updatedAt)
        VALUES (?,?,?,?,?,?,?)`,
      args: [
        c.id, c.companyId ?? null, c.accessToken ?? null,
        c.refreshToken ?? null, toUnix(c.tokenExpiresAt),
        toUnix(c.lastSyncAt), toUnix(c.updatedAt),
      ],
    });
  }
  console.log("  → freeeConfig 完了");

  // ---------- 6. accountItemCache ----------
  const items = src.prepare("SELECT * FROM AccountItemCache").all();
  console.log(`\nAccountItemCache: ${items.length} 件`);
  for (const i of items) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO accountItemCache
        (id, freeeId, name, shortcut1, shortcut2, category, updatedAt)
        VALUES (?,?,?,?,?,?,?)`,
      args: [i.id, i.freeeId, i.name, i.shortcut1 ?? null, i.shortcut2 ?? null, i.category ?? null, toUnix(i.updatedAt)],
    });
  }
  console.log("  → accountItemCache 完了");

  // ---------- 7. partnerCache ----------
  const partners = src.prepare("SELECT * FROM PartnerCache").all();
  console.log(`\nPartnerCache: ${partners.length} 件`);
  for (const p of partners) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO partnerCache (id, freeeId, name, updatedAt) VALUES (?,?,?,?)`,
      args: [p.id, p.freeeId, p.name, toUnix(p.updatedAt)],
    });
  }
  console.log("  → partnerCache 完了");

  // ---------- 8. memoTagCache ----------
  const tags = src.prepare("SELECT * FROM MemoTagCache").all();
  console.log(`\nMemoTagCache: ${tags.length} 件`);
  for (const t of tags) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO memoTagCache (id, freeeId, name, updatedAt) VALUES (?,?,?,?)`,
      args: [t.id, t.freeeId, t.name, toUnix(t.updatedAt)],
    });
  }
  console.log("  → memoTagCache 完了");

  // ---------- 9. sectionCache ----------
  const sections = src.prepare("SELECT * FROM SectionCache").all();
  console.log(`\nSectionCache: ${sections.length} 件`);
  for (const s of sections) {
    await dest.execute({
      sql: `INSERT OR REPLACE INTO sectionCache (id, freeeId, name, updatedAt) VALUES (?,?,?,?)`,
      args: [s.id, s.freeeId, s.name, toUnix(s.updatedAt)],
    });
  }
  console.log("  → sectionCache 完了");

  src.close();
  console.log("\n=== 移行完了 ===");
}

run().catch(err => {
  console.error("エラー:", err);
  process.exit(1);
});

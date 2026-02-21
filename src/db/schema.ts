import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ===== BetterAuth テーブル =====

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  // アプリ独自フィールド
  role: text("role").notNull().default("employee"),
  departmentId: text("departmentId"),
  freeePartnerId: integer("freeePartnerId"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  isHidden: integer("isHidden", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("mustChangePassword", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(9999),
  invitedAt: integer("invitedAt", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// ===== アプリ テーブル =====

export const department = sqliteTable("department", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  freeeSectionId: integer("freeeSectionId").unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const expenseReport = sqliteTable("expenseReport", {
  id: text("id").primaryKey(),
  submitterId: text("submitterId"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  category: text("category").notNull(),
  costType: text("costType").notNull(),
  taxType: text("taxType").notNull().default("inclusive"),
  paymentMethod: text("paymentMethod"),
  costEndDate: text("costEndDate"),
  hasReceipt: integer("hasReceipt", { mode: "boolean" }).notNull().default(false),
  supervisorName: text("supervisorName"),
  billingPartnerName: text("billingPartnerName"),
  billingPartnerId: integer("billingPartnerId"),
  usageDate: text("usageDate"),
  dueDate: text("dueDate"),
  recordingMonth: text("recordingMonth"),
  paymentMonth: text("paymentMonth"),
  status: text("status").notNull().default("draft"),
  isActual: integer("isActual", { mode: "boolean" }).notNull().default(false),
  accountItemId: integer("accountItemId"),
  accountItemName: text("accountItemName"),
  departmentId: text("departmentId"),
  adminMemo: text("adminMemo"),
  syncDescription: integer("syncDescription", { mode: "boolean" }).notNull().default(false),
  isQualifiedInvoice: integer("isQualifiedInvoice", { mode: "boolean" }).notNull().default(false),
  memoTagNames: text("memoTagNames"),
  freeDealId: integer("freeDealId"),
  freeePartnerId: integer("freeePartnerId"),
  freeeSyncedAt: integer("freeeSyncedAt", { mode: "timestamp" }),
  freeeSyncError: text("freeeSyncError"),
  source: text("source").notNull().default("app"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const attachment = sqliteTable("attachment", {
  id: text("id").primaryKey(),
  reportId: text("reportId").notNull().references(() => expenseReport.id, { onDelete: "cascade" }),
  fileName: text("fileName").notNull(),
  filePath: text("filePath").notNull(),
  mimeType: text("mimeType").notNull(),
  fileSize: integer("fileSize").notNull(),
  freeeReceiptId: integer("freeeReceiptId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const freeeConfig = sqliteTable("freeeConfig", {
  id: text("id").primaryKey().default("singleton"),
  companyId: integer("companyId"),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: integer("tokenExpiresAt", { mode: "timestamp" }),
  lastSyncAt: integer("lastSyncAt", { mode: "timestamp" }),
  lastPlSyncAt: integer("lastPlSyncAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const accountItemCache = sqliteTable("accountItemCache", {
  id: text("id").primaryKey(),
  freeeId: integer("freeeId").notNull().unique(),
  name: text("name").notNull(),
  shortcut1: text("shortcut1"),
  shortcut2: text("shortcut2"),
  category: text("category"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const partnerCache = sqliteTable("partnerCache", {
  id: text("id").primaryKey(),
  freeeId: integer("freeeId").notNull().unique(),
  name: text("name").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const memoTagCache = sqliteTable("memoTagCache", {
  id: text("id").primaryKey(),
  freeeId: integer("freeeId").notNull().unique(),
  name: text("name").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const sectionCache = sqliteTable("sectionCache", {
  id: text("id").primaryKey(),
  freeeId: integer("freeeId").notNull().unique(),
  name: text("name").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const freeeDealsCache = sqliteTable("freeeDealsCache", {
  id: text("id").primaryKey(),
  freeeDealId: integer("freeeDealId").notNull(),
  issueDate: text("issueDate").notNull(),    // YYYY-MM-DD
  dueDate: text("dueDate"),                   // YYYY-MM-DD
  partnerName: text("partnerName"),
  sectionName: text("sectionName"),           // 部門名
  accountItemName: text("accountItemName").notNull(),
  amount: integer("amount").notNull(),
  memoTagNames: text("memoTagNames"),         // カンマ区切り e.g. "仮,販管費振込確認用"
  syncedAt: integer("syncedAt", { mode: "timestamp" }).notNull(),
});

// ===== リレーション =====

export const userRelations = relations(user, ({ one, many }) => ({
  department: one(department, {
    fields: [user.departmentId],
    references: [department.id],
  }),
  expenseReports: many(expenseReport),
}));

export const departmentRelations = relations(department, ({ many }) => ({
  users: many(user),
  expenseReports: many(expenseReport),
}));

export const expenseReportRelations = relations(expenseReport, ({ one, many }) => ({
  submitter: one(user, {
    fields: [expenseReport.submitterId],
    references: [user.id],
  }),
  department: one(department, {
    fields: [expenseReport.departmentId],
    references: [department.id],
  }),
  attachments: many(attachment),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
  report: one(expenseReport, {
    fields: [attachment.reportId],
    references: [expenseReport.id],
  }),
}));

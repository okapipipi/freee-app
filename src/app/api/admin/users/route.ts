import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { sendInvitationEmail } from "@/lib/mailer";
import type { AuthUser } from "@/lib/auth";

// GET /api/admin/users
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.query.user.findMany({
    with: {
      department: { columns: { id: true, name: true } },
    },
    orderBy: [asc(schema.user.sortOrder), asc(schema.user.createdAt)],
  });

  const result = users.map(u => ({
    id:                 u.id,
    name:               u.name,
    email:              u.email,
    role:               u.role,
    isActive:           u.isActive,
    isHidden:           u.isHidden,
    mustChangePassword: u.mustChangePassword,
    freeePartnerId:     u.freeePartnerId,
    departmentId:       u.departmentId,
    department:         u.department,
    invitedAt:          u.invitedAt?.toISOString() ?? null,
    createdAt:          u.createdAt.toISOString(),
  }));

  return NextResponse.json({ users: result });
}

// POST /api/admin/users — 新規作成
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, role, departmentId, freeePartnerId } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name / email / password は必須です" }, { status: 400 });
  }

  const existing = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, email),
  });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスはすでに使用されています" }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const now = new Date();

  await db.insert(schema.user).values({
    id:                 userId,
    name,
    email,
    role:               role || "employee",
    departmentId:       departmentId || null,
    freeePartnerId:     freeePartnerId ? Number(freeePartnerId) : null,
    mustChangePassword: true,
    createdAt:          now,
    updatedAt:          now,
  });

  // BetterAuthのaccountテーブルにパスワードを登録
  await db.insert(schema.account).values({
    id:         crypto.randomUUID(),
    accountId:  userId,
    providerId: "credential",
    userId,
    password:   hashSync(password, 10),
    createdAt:  now,
    updatedAt:  now,
  });

  // 招待メール送信（失敗してもユーザー作成は成功とする）
  try {
    await sendInvitationEmail({ to: email, name, email, password });
    await db
      .update(schema.user)
      .set({ invitedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.user.id, userId));
  } catch (err) {
    console.error("招待メール送信失敗:", err);
  }

  return NextResponse.json(
    { success: true, user: { id: userId, name, email, role: role || "employee" } },
    { status: 201 }
  );
}

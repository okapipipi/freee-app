import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import type { AuthUser } from "@/lib/auth";

// PATCH /api/admin/users/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, password, role, departmentId, freeePartnerId, isActive, isHidden, mustChangePassword } = body;

  const existing = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (name              !== undefined) data.name              = name;
  if (email             !== undefined) data.email             = email;
  if (role              !== undefined) data.role              = role;
  if (isActive          !== undefined) data.isActive          = isActive;
  if (isHidden          !== undefined) data.isHidden          = isHidden;
  if (departmentId      !== undefined) data.departmentId      = departmentId || null;
  if (freeePartnerId    !== undefined) data.freeePartnerId    = freeePartnerId ? Number(freeePartnerId) : null;
  if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

  await db.update(schema.user).set(data).where(eq(schema.user.id, id));

  // パスワード変更の場合はaccountテーブルも更新
  if (password) {
    await db
      .update(schema.account)
      .set({ password: hashSync(password, 10), updatedAt: new Date() })
      .where(
        and(
          eq(schema.account.userId, id),
          eq(schema.account.providerId, "credential")
        )
      );
  }

  const updated = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, id),
    with: { department: { columns: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, user: updated });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import type { AuthUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { newPassword } = body;

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "パスワードは6文字以上で入力してください" },
      { status: 400 }
    );
  }

  const user = session.user as AuthUser;

  // BetterAuthのaccountテーブルのパスワードを更新
  await db
    .update(schema.account)
    .set({ password: hashSync(newPassword, 10), updatedAt: new Date() })
    .where(
      and(
        eq(schema.account.userId, user.id),
        eq(schema.account.providerId, "credential")
      )
    );

  // mustChangePasswordフラグをクリア
  await db
    .update(schema.user)
    .set({ mustChangePassword: false, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id));

  return NextResponse.json({ success: true });
}

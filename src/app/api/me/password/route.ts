import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { scryptAsync } from "@noble/hashes/scrypt";
import { hex } from "@better-auth/utils/hex";
import type { AuthUser } from "@/lib/auth";

async function hashPassword(password: string): Promise<string> {
  const salt = hex.encode(crypto.getRandomValues(new Uint8Array(16)));
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  return `${salt}:${hex.encode(key)}`;
}

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

  // BetterAuthのaccountテーブルのパスワードを更新（scrypt形式）
  await db
    .update(schema.account)
    .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
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

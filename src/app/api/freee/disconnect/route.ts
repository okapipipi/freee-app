import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(schema.freeeConfig)
    .set({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      companyId: null,
      lastSyncAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.freeeConfig.id, "singleton"));

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, count } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));

  const [
    [{ value: accountItems }],
    [{ value: partners }],
    [{ value: memoTags }],
    [{ value: sections }],
  ] = await Promise.all([
    db.select({ value: count() }).from(schema.accountItemCache),
    db.select({ value: count() }).from(schema.partnerCache),
    db.select({ value: count() }).from(schema.memoTagCache),
    db.select({ value: count() }).from(schema.sectionCache),
  ]);

  return NextResponse.json({
    connected: !!config?.accessToken,
    companyId: config?.companyId ?? null,
    lastSyncAt: config?.lastSyncAt?.toISOString() ?? null,
    masterCounts: { accountItems, partners, memoTags, sections },
  });
}

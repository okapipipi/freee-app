import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { freeeApiPost, getValidAccessToken } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
  }

  try {
    await getValidAccessToken();
  } catch {
    return NextResponse.json(
      { error: "freeeに接続されていません。先にfreee連携を行ってください。" },
      { status: 503 }
    );
  }

  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.companyId) {
    return NextResponse.json({ error: "事業所IDが設定されていません" }, { status: 503 });
  }

  const data = await freeeApiPost("/api/1/partners", {
    company_id: config.companyId,
    name: name.trim(),
  });

  const partner = data.partner;

  await db
    .insert(schema.partnerCache)
    .values({
      id: crypto.randomUUID(),
      freeeId: partner.id,
      name: partner.name,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.partnerCache.freeeId,
      set: { name: partner.name, updatedAt: new Date() },
    });

  return NextResponse.json({ partner: { id: partner.id, name: partner.name } }, { status: 201 });
}

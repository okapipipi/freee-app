import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { freeeApiGet } from "@/lib/freee";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

/** freeeの税区分一覧を返す（税区分名・コードの確認用） */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.companyId || !config.accessToken) {
    return NextResponse.json({ error: "freeeに接続されていません" }, { status: 503 });
  }

  const data = await freeeApiGet(`/api/1/taxes/codes?company_id=${config.companyId}`);
  return NextResponse.json({ taxes: data.taxes ?? [] });
}

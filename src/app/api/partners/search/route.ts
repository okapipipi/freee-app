import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc, like } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ partners: [] });

  const partners = await db
    .select({
      freeeId: schema.partnerCache.freeeId,
      name: schema.partnerCache.name,
    })
    .from(schema.partnerCache)
    .where(like(schema.partnerCache.name, `%${q}%`))
    .orderBy(asc(schema.partnerCache.name))
    .limit(10);

  return NextResponse.json({ partners });
}

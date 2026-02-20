import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc, like, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";

  const items = await db
    .select()
    .from(schema.accountItemCache)
    .where(
      q
        ? or(
            like(schema.accountItemCache.name, `%${q}%`),
            like(schema.accountItemCache.shortcut1, `%${q}%`),
            like(schema.accountItemCache.shortcut2, `%${q}%`),
          )
        : undefined
    )
    .orderBy(asc(schema.accountItemCache.name))
    .limit(30);

  return NextResponse.json({ items });
}

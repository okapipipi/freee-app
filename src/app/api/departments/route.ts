import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const depts = await db
    .select({ id: schema.department.id, name: schema.department.name })
    .from(schema.department)
    .orderBy(asc(schema.department.name));

  if (depts.length > 0) {
    return NextResponse.json({ departments: depts });
  }

  // SectionCache から生成（freee同期済みの部門データ）
  const sections = await db
    .select({
      id: schema.sectionCache.id,
      name: schema.sectionCache.name,
      freeeId: schema.sectionCache.freeeId,
    })
    .from(schema.sectionCache)
    .orderBy(asc(schema.sectionCache.name));

  const departments = sections.map(s => ({ id: s.id, name: s.name, freeeId: s.freeeId }));
  return NextResponse.json({ departments });
}

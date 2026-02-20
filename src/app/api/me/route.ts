import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as AuthUser;

  const dept = user.departmentId
    ? await db.query.department.findFirst({
        where: (d, { eq }) => eq(d.id, user.departmentId!),
        columns: { id: true, name: true },
      })
    : null;

  return NextResponse.json({
    id:             user.id,
    name:           user.name,
    email:          user.email,
    role:           user.role,
    departmentId:   user.departmentId ?? null,
    departmentName: dept?.name ?? null,
    freeePartnerId: user.freeePartnerId ?? null,
  });
}

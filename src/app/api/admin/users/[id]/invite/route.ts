import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendInvitationEmail } from "@/lib/mailer";
import type { AuthUser } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, id),
    columns: { name: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await sendInvitationEmail({
    to:       user.email,
    name:     user.name,
    email:    user.email,
    password: "digiman1007",
  });

  await db
    .update(schema.user)
    .set({ invitedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.user.id, id));

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = session.user as AuthUser;

  const attachment = await db.query.attachment.findFirst({
    where: (a, { eq }) => eq(a.id, id),
    with: {
      report: { columns: { submitterId: true } },
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    (user.role === "employee" || user.role === "intern") &&
    attachment.report.submitterId !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Vercel Blob URL の場合はリダイレクト
  if (attachment.filePath.startsWith("http")) {
    return NextResponse.redirect(attachment.filePath);
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}

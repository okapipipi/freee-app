import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { saveUploadedFile } from "@/lib/uploads";
import { sendSubmissionNotification } from "@/lib/mailer";
import type { AuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as AuthUser;

  try {
    const fd = await request.formData();
    const get = (key: string) => (fd.get(key) as string) ?? "";

    const title              = get("title");
    const description        = get("description");
    const amount             = parseInt(get("amount"), 10);
    const category           = get("category");
    const costType           = get("costType");
    const taxType            = get("taxType") || "inclusive";
    const paymentMethod      = get("paymentMethod") || null;
    const costEndDate        = get("costEndDate") || null;
    const hasReceipt         = get("hasReceipt") === "yes";
    const supervisorName     = get("supervisorName") || null;
    const billingPartnerName = get("billingPartnerName") || null;
    const billingPartnerId   = parseInt(get("billingPartnerId")) || null;
    const usageDate          = get("usageDate") || null;
    const recordingMonth     = get("recordingMonth") || null;
    const paymentMonth       = get("paymentMonth") || null;
    const dueDate            = get("dueDate") || null;
    const files              = fd.getAll("attachments") as File[];

    if (!category || !costType || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const isExpense = category === "expense" || category === "expense_billable";
    const submitter = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, user.id),
      columns: { departmentId: true },
    });
    const deptIdRaw = get("departmentId") || null;
    const departmentId = isExpense ? (submitter?.departmentId ?? null) : (deptIdRaw || null);

    const savedFiles = await Promise.all(
      files.filter(f => f.size > 0).map(f => saveUploadedFile(f))
    );

    const reportId = crypto.randomUUID();
    const now = new Date();

    await db.insert(schema.expenseReport).values({
      id:              reportId,
      submitterId:     user.id,
      title:           title || `${category} 申請`,
      description,
      amount,
      category,
      costType,
      taxType,
      paymentMethod,
      costEndDate,
      hasReceipt,
      supervisorName,
      billingPartnerName,
      billingPartnerId,
      usageDate,
      recordingMonth,
      paymentMonth,
      dueDate,
      departmentId,
      status:          "submitted",
      createdAt:       now,
      updatedAt:       now,
    });

    if (savedFiles.length > 0) {
      await db.insert(schema.attachment).values(
        savedFiles.map(f => ({
          id:        crypto.randomUUID(),
          reportId,
          fileName:  f.fileName,
          filePath:  f.filePath,
          mimeType:  f.mimeType,
          fileSize:  f.fileSize,
          createdAt: now,
        }))
      );
    }

    sendSubmissionNotification({
      submitterName: user.name ?? "不明",
      title:         title || `${category} 申請`,
      amount,
      category,
      reportId,
    }).catch((e) => console.error("[通知メール送信失敗]", e));

    return NextResponse.json({ success: true, reportId });
  } catch (err: any) {
    console.error("[POST /api/reports]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as AuthUser;
  const { searchParams } = request.nextUrl;
  const status        = searchParams.get("status");
  const page          = parseInt(searchParams.get("page") ?? "1", 10);
  const limit         = 20;
  const search        = searchParams.get("search");
  const categoryGroup = searchParams.get("categoryGroup");

  const conditions: any[] = [];

  if (user.role === "employee" || user.role === "intern") {
    conditions.push(eq(schema.expenseReport.submitterId, user.id));
  }
  if (status === "pending") {
    conditions.push(inArray(schema.expenseReport.status, ["submitted", "on_hold"]));
  } else if (status === "approved_or_synced") {
    conditions.push(inArray(schema.expenseReport.status, ["approved", "synced_to_freee"]));
  } else if (status) {
    conditions.push(eq(schema.expenseReport.status, status));
  }
  if (categoryGroup === "sga") {
    conditions.push(eq(schema.expenseReport.category, "sga"));
  } else if (categoryGroup === "expense") {
    conditions.push(eq(schema.expenseReport.category, "expense"));
  } else if (categoryGroup === "billable") {
    conditions.push(inArray(schema.expenseReport.category, ["sga_billable", "expense_billable"]));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const reports = await db.query.expenseReport.findMany({
    where: whereClause ? () => whereClause : undefined,
    with: {
      submitter:  { columns: { name: true } },
      attachments: { columns: { id: true, fileName: true } },
      department: { columns: { name: true } },
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    limit,
    offset: (page - 1) * limit,
  });

  const total = reports.length; // 簡易実装

  return NextResponse.json({ reports, total, page, limit });
}

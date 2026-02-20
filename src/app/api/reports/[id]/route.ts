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

  const report = await db.query.expenseReport.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: {
      submitter:  { columns: { id: true, name: true, email: true, freeePartnerId: true } },
      attachments: true,
      department: { columns: { id: true, name: true } },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((user.role === "employee" || user.role === "intern") && report.submitterId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ report });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as AuthUser;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const report = await db.query.expenseReport.findFirst({
    where: (r, { eq }) => eq(r.id, id),
  });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  if (body.action === "approve") {
    const {
      accountItemId, accountItemName, memoTagNames, taxType, dueDate,
      recordingMonth, paymentMonth, departmentId, adminMemo, syncDescription, isQualifiedInvoice,
    } = body;

    await db.update(schema.expenseReport).set({
      status:             "approved",
      accountItemId:      accountItemId      ?? report.accountItemId,
      accountItemName:    accountItemName    ?? report.accountItemName,
      memoTagNames:       memoTagNames       ?? report.memoTagNames,
      taxType:            taxType            ?? report.taxType,
      dueDate:            dueDate            ?? report.dueDate,
      recordingMonth:     recordingMonth     ?? report.recordingMonth,
      paymentMonth:       paymentMonth       ?? report.paymentMonth,
      departmentId:       departmentId       ?? report.departmentId,
      adminMemo:          adminMemo          ?? report.adminMemo,
      syncDescription:    syncDescription    ?? report.syncDescription,
      isQualifiedInvoice: isQualifiedInvoice ?? report.isQualifiedInvoice,
      updatedAt:          now,
    }).where(eq(schema.expenseReport.id, id));

    const updated = await db.query.expenseReport.findFirst({ where: (r, { eq }) => eq(r.id, id) });
    return NextResponse.json({ success: true, report: updated });
  }

  if (body.action === "on_hold") {
    await db.update(schema.expenseReport).set({ status: "on_hold", updatedAt: now }).where(eq(schema.expenseReport.id, id));
    const updated = await db.query.expenseReport.findFirst({ where: (r, { eq }) => eq(r.id, id) });
    return NextResponse.json({ success: true, report: updated });
  }

  if (body.action === "reject") {
    await db.update(schema.expenseReport).set({
      status:    "rejected",
      adminMemo: body.adminMemo ?? report.adminMemo,
      updatedAt: now,
    }).where(eq(schema.expenseReport.id, id));
    const updated = await db.query.expenseReport.findFirst({ where: (r, { eq }) => eq(r.id, id) });
    return NextResponse.json({ success: true, report: updated });
  }

  if (body.action === "revert") {
    await db.update(schema.expenseReport).set({ status: "submitted", updatedAt: now }).where(eq(schema.expenseReport.id, id));
    const updated = await db.query.expenseReport.findFirst({ where: (r, { eq }) => eq(r.id, id) });
    return NextResponse.json({ success: true, report: updated });
  }

  // 管理者フィールドのみ保存
  const {
    accountItemId, accountItemName, memoTagNames, taxType, dueDate,
    recordingMonth, paymentMonth, departmentId, adminMemo, syncDescription, isQualifiedInvoice,
  } = body;

  const data: Record<string, unknown> = { updatedAt: now };
  if (accountItemId     !== undefined) data.accountItemId     = accountItemId;
  if (accountItemName   !== undefined) data.accountItemName   = accountItemName;
  if (memoTagNames      !== undefined) data.memoTagNames      = memoTagNames;
  if (taxType           !== undefined) data.taxType           = taxType;
  if (dueDate           !== undefined) data.dueDate           = dueDate;
  if (recordingMonth    !== undefined) data.recordingMonth    = recordingMonth;
  if (paymentMonth      !== undefined) data.paymentMonth      = paymentMonth;
  if (departmentId      !== undefined) data.departmentId      = departmentId;
  if (adminMemo         !== undefined) data.adminMemo         = adminMemo;
  if (syncDescription   !== undefined) data.syncDescription   = syncDescription;
  if (isQualifiedInvoice !== undefined) data.isQualifiedInvoice = isQualifiedInvoice;

  await db.update(schema.expenseReport).set(data).where(eq(schema.expenseReport.id, id));
  const updated = await db.query.expenseReport.findFirst({ where: (r, { eq }) => eq(r.id, id) });
  return NextResponse.json({ success: true, report: updated });
}

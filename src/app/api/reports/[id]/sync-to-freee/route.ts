import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, like } from "drizzle-orm";
import { createDeal, getTaxCodeByName, uploadReceiptToFreee } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

const TAX_NAME_EXCLUDED      = "対象外";
const TAX_NAME_QUALIFIED     = "課対仕入10%";
const TAX_NAME_NON_QUALIFIED = "課対仕入（控80）10%";

function getEndOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const d = new Date(year, month, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const report = await db.query.expenseReport.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: {
      submitter:   { columns: { name: true, freeePartnerId: true } },
      department:  { columns: { name: true, freeeSectionId: true } },
      attachments: { columns: { id: true, filePath: true, fileName: true, mimeType: true } },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
  }
  if (report.status !== "approved") {
    return NextResponse.json({ error: "承認済みの申請のみfreee連携できます" }, { status: 400 });
  }
  if (!report.accountItemId) {
    return NextResponse.json({ error: "勘定科目が設定されていません" }, { status: 400 });
  }

  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.companyId || !config.accessToken) {
    return NextResponse.json({ error: "freeeに接続されていません" }, { status: 503 });
  }

  try {
    const isBillable = report.category === "sga_billable" || report.category === "expense_billable";
    const isExpense  = report.category === "expense"      || report.category === "expense_billable";
    const isOverseas = report.taxType === "overseas";

    const issueDate = isExpense
      ? report.usageDate!
      : getEndOfMonth(report.recordingMonth!);
    const dueDate = report.dueDate || issueDate;

    let partnerId: number | null = null;
    if (isBillable) {
      partnerId = report.billingPartnerId;
    } else if (isExpense) {
      partnerId = report.submitter?.freeePartnerId ?? null;
    }

    const taxName = (isBillable || isOverseas)
      ? TAX_NAME_EXCLUDED
      : report.isQualifiedInvoice
        ? TAX_NAME_QUALIFIED
        : TAX_NAME_NON_QUALIFIED;

    const taxCode = await getTaxCodeByName(config.companyId, taxName);
    if (taxCode === null) {
      return NextResponse.json(
        { error: `税区分「${taxName}」がfreeeに見つかりません。` },
        { status: 400 }
      );
    }

    let sectionId: number | null = report.department?.freeeSectionId ?? null;
    if (!sectionId && report.department?.name) {
      const cached = await db.query.sectionCache.findFirst({
        where: (s, { eq }) => eq(s.name, report.department!.name),
      });
      sectionId = cached?.freeeId ?? null;
    }

    const tagNames = (report.memoTagNames ?? "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    let tagIds: number[] = [];
    if (tagNames.length > 0) {
      const tagCache = await db.query.memoTagCache.findMany({
        where: (t, { inArray }) => inArray(t.name, tagNames),
      });
      tagIds = tagCache.map(t => t.freeeId);
    }

    const parts: string[] = [];
    if (report.syncDescription && report.description) parts.push(report.description);
    if (report.adminMemo) parts.push(report.adminMemo);
    const description = parts.join("\n");

    const receiptIds: number[] = [];
    const uploadedAttachmentIds: { attachmentId: string; freeeReceiptId: number }[] = [];

    for (const att of report.attachments ?? []) {
      try {
        const receiptId = await uploadReceiptToFreee(
          config.companyId,
          att.filePath,
          att.fileName,
          att.mimeType,
        );
        receiptIds.push(receiptId);
        uploadedAttachmentIds.push({ attachmentId: att.id, freeeReceiptId: receiptId });
      } catch (err) {
        console.warn(`[sync-to-freee] 証憑アップロードスキップ: ${att.fileName}`, err);
      }
    }

    const result = await createDeal({
      companyId: config.companyId,
      issueDate,
      dueDate,
      partnerId,
      details: [{
        accountItemId: report.accountItemId,
        taxCode,
        amount:      report.amount,
        sectionId,
        tagIds,
        description: description || undefined,
        receiptIds:  receiptIds.length > 0 ? receiptIds : undefined,
      }],
    });

    await db.update(schema.expenseReport).set({
      status:         "synced_to_freee",
      freeDealId:     result.deal.id,
      freeePartnerId: partnerId,
      freeeSyncedAt:  new Date(),
      freeeSyncError: null,
      updatedAt:      new Date(),
    }).where(eq(schema.expenseReport.id, id));

    for (const { attachmentId, freeeReceiptId } of uploadedAttachmentIds) {
      await db.update(schema.attachment).set({ freeeReceiptId }).where(eq(schema.attachment.id, attachmentId));
    }

    return NextResponse.json({ success: true, dealId: result.deal.id });
  } catch (err: any) {
    console.error("[sync-to-freee]", err);
    await db.update(schema.expenseReport).set({
      freeeSyncError: err.message,
      updatedAt: new Date(),
    }).where(eq(schema.expenseReport.id, id));
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

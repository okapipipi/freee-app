"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Check, X, FileText, Paperclip } from "lucide-react";
import Link from "next/link";

// ===== 型定義 =====
type AttachmentItem = {
  id: string; fileName: string; filePath: string; mimeType: string;
};
type Report = {
  id: string; title: string; category: string; costType: string;
  amount: number; status: string; hasReceipt: boolean; taxType: string;
  paymentMethod: string | null; costEndDate: string | null;
  usageDate: string | null; recordingMonth: string | null;
  paymentMonth: string | null; dueDate: string | null;
  description: string; supervisorName: string | null;
  billingPartnerName: string | null; billingPartnerId: number | null;
  accountItemId: number | null; accountItemName: string | null;
  memoTagNames: string | null; isQualifiedInvoice: boolean;
  syncDescription: boolean; adminMemo: string | null;
  departmentId: string | null; createdAt: string;
  freeDealId: number | null; freeeSyncedAt: string | null; freeeSyncError: string | null;
  submitter: { id: string; name: string; email: string; freeePartnerId: number | null } | null;
  department: { id: string; name: string } | null;
  attachments: AttachmentItem[];
};
type AccountItem = { id: string; freeeId: number; name: string; shortcut1: string | null };
type MemoTag    = { id: string; freeeId: number; name: string };
type Dept       = { id: string; name: string };

// ===== 定数 =====
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted:       { label: "申請中",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  on_hold:         { label: "確認中",      color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:        { label: "承認済",      color: "bg-green-100 text-green-700 border-green-200" },
  rejected:        { label: "却下",        color: "bg-red-100 text-red-700 border-red-200" },
  synced_to_freee: { label: "freee連携済", color: "bg-purple-100 text-purple-700 border-purple-200" },
  draft:           { label: "下書き",      color: "bg-gray-100 text-gray-600 border-gray-200" },
};
const CATEGORY_LABELS: Record<string, string> = {
  sga: "販管費", sga_billable: "販管費（取引先請求予定）",
  expense: "立替経費", expense_billable: "立替経費（取引先請求予定）",
};
const COST_TYPE_LABELS: Record<string, string> = {
  running_monthly: "月額費用", running_annual: "年間費用", onetime: "単発費用",
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "銀行振込", black_amex: "黒AMEX（安達）",
  company_amex: "会社AMEX", upsider: "UPSIDER", other: "その他",
};
const TAX_TYPE_LABELS: Record<string, string> = {
  inclusive: "税込（国内）", overseas: "海外・税なし（対象外）",
};

// 表示しないメモタグ
const EXCLUDED_MEMO_TAGS = new Set(["会社公式経費", "自由経費", "細川"]);

// ===== ユーティリティ =====
/** 利用日の翌月末日を YYYY-MM-DD で返す */
function calcNextMonthEnd(usageDate: string): string {
  const d = new Date(usageDate + "T00:00:00");
  // 翌月の末日 = 翌々月の0日
  const last = new Date(d.getFullYear(), d.getMonth() + 2, 0);
  return last.toISOString().split("T")[0];
}

function suggestMemoTags(report: Report): string[] {
  const tags: string[] = [];
  const isExp = report.category === "expense" || report.category === "expense_billable";
  tags.push(isExp ? "給与振込確認用" : "販管費振込確認用");
  if (!report.hasReceipt) tags.push("仮");
  return tags;
}

// ===== 勘定科目検索 =====
function AccountItemSearch({
  value, onChange,
}: { value: { id: number | null; name: string }; onChange: (v: { id: number; name: string }) => void }) {
  const [q, setQ]         = useState(value.name);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [open, setOpen]   = useState(false);

  useEffect(() => {
    if (!q) { setItems([]); return; }
    const t = setTimeout(async () => {
      const res  = await fetch(`/api/account-items?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={e => { setQ(e.target.value); if (!e.target.value) onChange({ id: 0, name: "" }); }}
        placeholder="勘定科目名で検索"
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
          {items.map(it => (
            <button key={it.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
              onMouseDown={() => { onChange({ id: it.freeeId, name: it.name }); setQ(it.name); setOpen(false); }}
            >
              <span>{it.name}</span>
              {it.shortcut1 && <span className="text-xs text-gray-400">{it.shortcut1}</span>}
            </button>
          ))}
        </div>
      )}
      {value.id ? (
        <p className="text-xs text-green-600 mt-0.5">freee勘定科目ID: {value.id}</p>
      ) : null}
    </div>
  );
}

// ===== メモタグ選択 =====
function MemoTagSelect({
  selected, onChange, allTags,
}: { selected: string[]; onChange: (t: string[]) => void; allTags: MemoTag[] }) {
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(t => t !== name) : [...selected, name]);
  return (
    <div className="flex flex-wrap gap-2">
      {allTags.map(tag => (
        <button key={tag.id} type="button" onClick={() => toggle(tag.name)}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            selected.includes(tag.name)
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
          }`}
        >{tag.name}</button>
      ))}
    </div>
  );
}

// ===== 添付ファイルビューワー =====
function AttachmentViewer({ attachments }: { attachments: AttachmentItem[] }) {
  const [idx, setIdx] = useState(0);
  if (attachments.length === 0) return null;
  const att = attachments[idx];
  const isPdf = att.mimeType === "application/pdf";
  const isImg = att.mimeType.startsWith("image/");

  return (
    <div className="sticky top-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" />添付ファイル（{attachments.length}件）
        </h3>
        <a href={`/api/attachments/${att.id}`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline">別タブで開く</a>
      </div>

      {/* ファイルタブ */}
      {attachments.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((a, i) => (
            <button key={a.id} type="button" onClick={() => setIdx(i)}
              className={`text-xs px-2 py-1 rounded border truncate max-w-[140px] ${
                i === idx ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-300 hover:bg-gray-50"
              }`}
            >{a.fileName}</button>
          ))}
        </div>
      )}
      {attachments.length === 1 && (
        <p className="text-xs text-gray-500 truncate">{att.fileName}</p>
      )}

      {/* プレビュー */}
      <div className="rounded-lg border overflow-hidden bg-gray-50">
        {isPdf && (
          <iframe
            src={`/api/attachments/${att.id}`}
            className="w-full"
            style={{ height: "75vh" }}
            title={att.fileName}
          />
        )}
        {isImg && (
          <img
            src={`/api/attachments/${att.id}`}
            alt={att.fileName}
            className="w-full object-contain max-h-[75vh]"
          />
        )}
        {!isPdf && !isImg && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <FileText className="h-8 w-8" />
            <span>{att.fileName}</span>
            <a href={`/api/attachments/${att.id}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-xs">ダウンロード</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== メインコンポーネント =====
export default function AdminReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [report,      setReport]      = useState<Report | null>(null);
  const [allTags,     setAllTags]     = useState<MemoTag[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // 管理者編集フィールド
  const [accountItemId,    setAccountItemId]    = useState<number | null>(null);
  const [accountItemName,  setAccountItemName]  = useState("");
  const [memoTags,         setMemoTags]         = useState<string[]>([]);
  const [taxType,          setTaxType]          = useState("inclusive");
  const [dueDate,          setDueDate]          = useState("");
  const [recordingMonth,   setRecordingMonth]   = useState("");
  const [paymentMonth,     setPaymentMonth]     = useState("");
  const [departmentId,     setDepartmentId]     = useState("");
  const [adminMemo,        setAdminMemo]        = useState("");
  const [syncDescription,  setSyncDescription]  = useState(false);
  const [isQualifiedInvoice, setIsQualifiedInvoice] = useState(false);

  // 支払期日が変わったらCF（支払月）を自動更新
  useEffect(() => {
    if (dueDate && dueDate.length >= 7) {
      setPaymentMonth(dueDate.substring(0, 7));
    }
  }, [dueDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, tagRes, deptRes] = await Promise.all([
        fetch(`/api/reports/${id}`),
        fetch("/api/memo-tags"),
        fetch("/api/departments"),
      ]);
      const repData  = await repRes.json();
      const tagData  = await tagRes.json();
      const deptData = await deptRes.json();

      const r: Report = repData.report;
      setReport(r);
      setAllTags(tagData.tags ?? []);
      const DEPT_PRIORITY = ["営業代行部門", "Corporate部門", "Salesforce部門"];
      const rawDepts: Dept[] = deptData.departments ?? [];
      rawDepts.sort((a, b) => {
        const ai = DEPT_PRIORITY.indexOf(a.name);
        const bi = DEPT_PRIORITY.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      });
      setDepartments(rawDepts);

      const isExp = r.category === "expense" || r.category === "expense_billable";

      setAccountItemId(r.accountItemId);
      setAccountItemName(r.accountItemName ?? "");
      setMemoTags(r.memoTagNames
        ? r.memoTagNames.split(",").map((t: string) => t.trim()).filter(Boolean)
        : suggestMemoTags(r));
      setTaxType(r.taxType);
      setDepartmentId(r.departmentId ?? "");
      setAdminMemo(r.adminMemo ?? "");
      setSyncDescription(r.syncDescription);
      setIsQualifiedInvoice(r.isQualifiedInvoice);

      // 支払期日：保存済みがあればそれを、なければ経費は利用日の翌月末を自動計算
      const resolvedDue = r.dueDate || (isExp && r.usageDate ? calcNextMonthEnd(r.usageDate) : "");
      setDueDate(resolvedDue);

      // PL計上月：保存済みがあればそれを、なければ経費は利用日の月・販管費は入力値
      setRecordingMonth(r.recordingMonth || (isExp && r.usageDate ? r.usageDate.substring(0, 7) : ""));

      // CF（支払月）：保存済みがあればそれを、なければ支払期日の月
      setPaymentMonth(r.paymentMonth || (resolvedDue ? resolvedDue.substring(0, 7) : ""));
    } catch {
      toast.error("申請の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function buildPayload() {
    return {
      accountItemId, accountItemName,
      memoTagNames:       memoTags.join(","),
      taxType,
      dueDate:            dueDate || null,
      recordingMonth:     recordingMonth || null,
      paymentMonth:       paymentMonth || null,
      departmentId:       departmentId || null,
      adminMemo:          adminMemo || null,
      syncDescription,
      isQualifiedInvoice,
    };
  }

  async function handleApprove() {
    setSaving(true);
    try {
      // Step1: 承認
      const approveRes  = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", ...buildPayload() }) });
      const approveData = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveData.error);

      // Step2: freee連携
      const syncRes  = await fetch(`/api/reports/${id}/sync-to-freee`, { method: "POST" });
      const syncData = await syncRes.json();
      if (!syncRes.ok) throw new Error(`承認しましたがfreee連携に失敗しました: ${syncData.error}`);

      toast.success(`freeeに登録しました（取引ID: ${syncData.dealId}）`);
      router.push("/admin/reports");
    } catch (err: any) { toast.error(`${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleOnHold() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "on_hold" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("確認中にしました");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleReject() {
    if (!confirm("この申請を却下しますか？")) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", adminMemo: adminMemo || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("申請を却下しました");
      router.push("/admin/reports");
    } catch (err: any) { toast.error(`却下に失敗: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("保存しました");
    } catch (err: any) { toast.error(`保存失敗: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleRevert() {
    if (!confirm("ステータスを「申請中」に戻しますか？")) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revert" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("申請中に戻しました");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>;
  if (!report)  return <div className="text-center py-16 text-gray-400">申請が見つかりません</div>;

  const st        = STATUS_LABELS[report.status] ?? { label: report.status, color: "bg-gray-100 text-gray-600" };
  const isExpense = report.category === "expense" || report.category === "expense_billable";
  const canEdit   = ["submitted", "on_hold", "approved"].includes(report.status);
  const hasFiles  = report.attachments.length > 0;

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/admin/reports" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{report.title}</h1>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border ${st.color}`}>
              {st.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {report.submitter?.name} • {new Date(report.createdAt).toLocaleDateString("ja-JP")} 申請
          </p>
        </div>
      </div>

      {/* 2カラムレイアウト（左：freee登録設定、右：申請内容＋添付） */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* ===== 左カラム：freee登録設定 + ボタン ===== */}
        <div className="space-y-5">

          {/* 管理者設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />freee登録設定（管理者）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* 勘定科目 */}
              <div className="space-y-1">
                <Label>勘定科目</Label>
                <AccountItemSearch
                  value={{ id: accountItemId, name: accountItemName }}
                  onChange={v => { setAccountItemId(v.id || null); setAccountItemName(v.name); }}
                />
              </div>

              {/* 税区分 */}
              <div className="space-y-1">
                <Label>税区分（確認・変更）</Label>
                <Select value={taxType} onValueChange={setTaxType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inclusive">税込（国内）</SelectItem>
                    <SelectItem value="overseas">海外・税なし（対象外）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 適格請求書 */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isQualifiedInvoice" className="h-4 w-4"
                  checked={isQualifiedInvoice} onChange={e => setIsQualifiedInvoice(e.target.checked)} />
                <Label htmlFor="isQualifiedInvoice" className="cursor-pointer">適格請求書等（インボイス）</Label>
              </div>

              {/* 部門（全申請で変更可・申請者部門を参考表示） */}
              <div className="space-y-1">
                <Label>部門</Label>
                <Select
                  value={departmentId || "__none__"}
                  onValueChange={v => setDepartmentId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="部門を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未設定</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isExpense && report.department && (
                  <p className="text-xs text-gray-400">申請者の部門: {report.department.name}</p>
                )}
              </div>

              {/* メモタグ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>メモタグ</Label>
                  <button type="button" onClick={() => setMemoTags(suggestMemoTags(report))}
                    className="text-xs text-blue-600 hover:underline">自動提案に戻す</button>
                </div>
                <MemoTagSelect selected={memoTags} onChange={setMemoTags}
                  allTags={allTags.filter(t => !EXCLUDED_MEMO_TAGS.has(t.name))} />
                {memoTags.length > 0 && (
                  <p className="text-xs text-gray-400">選択中: {memoTags.join("、")}</p>
                )}
                {!report.hasReceipt && (
                  <p className="text-xs text-amber-600">※ 領収書なしのため「仮」タグが自動付与されています</p>
                )}
              </div>

              {/* 利用内容をfreee備考に含める */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="syncDescription" className="h-4 w-4"
                  checked={syncDescription} onChange={e => setSyncDescription(e.target.checked)} />
                <Label htmlFor="syncDescription" className="cursor-pointer">
                  利用内容をfreeeの備考に含める
                </Label>
              </div>

              {/* 管理者メモ */}
              <div className="space-y-1">
                <Label>管理者メモ（freee備考欄に反映）</Label>
                <Textarea rows={2} placeholder="freeeの取引備考欄に入力するメモ"
                  value={adminMemo} onChange={e => setAdminMemo(e.target.value)} />
              </div>

              {/* 支払期日（経費は自動計算済み・編集可） */}
              <div className="space-y-1">
                <Label>
                  支払期日
                  {isExpense && <span className="ml-1 text-xs text-blue-600">（利用日の翌月末を自動入力）</span>}
                </Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>

              {/* PL計上月 / CF（支払月） */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>
                    PL計上月
                    {isExpense && <span className="ml-1 text-xs text-blue-600">（利用日の月）</span>}
                  </Label>
                  <Input type="month" value={recordingMonth} onChange={e => setRecordingMonth(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>
                    CF（支払月）
                    <span className="ml-1 text-xs text-blue-600">（支払期日の月）</span>
                  </Label>
                  <Input type="month" value={paymentMonth} onChange={e => setPaymentMonth(e.target.value)} />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* アクションボタン */}
          <div className="space-y-3 pb-6">
            {report.status === "on_hold" && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
                <strong>確認中：</strong>社長確認等が完了したら「承認する」を押してください。freeeへの連携はまだ行われていません。
              </div>
            )}
            {report.status === "synced_to_freee" && report.freeDealId && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-xs text-purple-800">
                <strong>freee連携済：</strong>取引ID {report.freeDealId}
                {report.freeeSyncedAt && (
                  <span className="ml-2 text-purple-600">
                    （{new Date(report.freeeSyncedAt).toLocaleString("ja-JP")} 登録）
                  </span>
                )}
              </div>
            )}
            {report.freeeSyncError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
                <strong>連携エラー：</strong>{report.freeeSyncError}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {(report.status === "on_hold" || report.status === "approved" || report.status === "rejected") && (
                  <Button type="button" variant="outline" size="sm" onClick={handleRevert} disabled={saving}>
                    申請中に戻す
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                {canEdit && (
                  <>
                    <Button type="button" variant="outline" onClick={handleReject} disabled={saving}
                      className="border-red-300 text-red-600 hover:bg-red-50">
                      <X className="h-4 w-4 mr-1" />却下
                    </Button>
                    <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving}>
                      一時保存
                    </Button>
                    {report.status !== "on_hold" && (
                      <Button type="button" variant="outline" onClick={handleOnHold} disabled={saving}
                        className="border-yellow-400 text-yellow-700 hover:bg-yellow-50">
                        確認中にする
                      </Button>
                    )}
                    {report.status !== "approved" && (
                      <Button type="button" onClick={handleApprove} disabled={saving}>
                        <Check className="h-4 w-4 mr-1" />
                        {saving ? "処理中..." : "承認・連携する"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 右カラム：申請内容 ＋ 添付ファイルビューワー ===== */}
        <div className="space-y-5">
          {/* 申請内容（読み取り専用） */}
          <Card>
            <CardHeader><CardTitle className="text-base">申請内容</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">種別</dt>
                  <dd className="font-medium">{CATEGORY_LABELS[report.category] ?? report.category}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">コスト種別</dt>
                  <dd>{COST_TYPE_LABELS[report.costType] ?? report.costType}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">金額（税込）</dt>
                  <dd className="font-mono text-base font-semibold">¥{report.amount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">税区分</dt>
                  <dd>{TAX_TYPE_LABELS[report.taxType] ?? report.taxType}</dd>
                </div>
                {report.usageDate && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">利用日</dt>
                    <dd>{report.usageDate}</dd>
                  </div>
                )}
                {report.recordingMonth && !isExpense && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">計上月（申請値）</dt>
                    <dd>{report.recordingMonth}</dd>
                  </div>
                )}
                {report.paymentMonth && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">支払月（申請値）</dt>
                    <dd>{report.paymentMonth}</dd>
                  </div>
                )}
                {report.paymentMethod && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">支払方法</dt>
                    <dd>{PAYMENT_METHOD_LABELS[report.paymentMethod] ?? report.paymentMethod}</dd>
                  </div>
                )}
                {report.costEndDate && (
                  <div>
                    <dt className="text-gray-500 text-xs mb-0.5">費用発生終了予定</dt>
                    <dd>{report.costEndDate === "unknown" ? "不明" : report.costEndDate}</dd>
                  </div>
                )}
                {report.billingPartnerName && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 text-xs mb-0.5">取引先（請求先）</dt>
                    <dd className="text-amber-700 font-medium">
                      {report.billingPartnerName}
                      {report.billingPartnerId ? ` (freeeID: ${report.billingPartnerId})` : " ※freee未連携"}
                    </dd>
                  </div>
                )}
                <div className="col-span-2">
                  <dt className="text-gray-500 text-xs mb-0.5">領収書・請求書</dt>
                  <dd className={report.hasReceipt ? "text-green-600" : "text-amber-600"}>
                    {report.hasReceipt ? "あり" : "なし"}
                  </dd>
                </div>
                {report.supervisorName && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 text-xs mb-0.5">上司承認者</dt>
                    <dd>{report.supervisorName}</dd>
                  </div>
                )}
                {report.description && (
                  <div className="col-span-2">
                    <dt className="text-gray-500 text-xs mb-0.5">利用内容</dt>
                    <dd className="whitespace-pre-wrap text-gray-700">{report.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">申請者</dt>
                  <dd>{report.submitter?.name}（{report.submitter?.email}）</dd>
                </div>
                <div>
                  <dt className="text-gray-500 text-xs mb-0.5">申請者の部門</dt>
                  <dd>{report.department?.name ?? "未設定"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* 添付ファイルビューワー */}
          {hasFiles && <AttachmentViewer attachments={report.attachments} />}
        </div>
      </div>
    </div>
  );
}

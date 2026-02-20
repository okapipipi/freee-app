"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PartnerSearch } from "@/components/ui/partner-search";
import { toast } from "sonner";
import { Paperclip, X, Send, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  hasReceipt:          z.enum(["yes", "no"], { error: "選択してください" }),
  category:            z.enum(["expense", "expense_billable"], { error: "種別を選択してください" }),
  billingPartnerName:  z.string().optional(),
  billingPartnerId:    z.number().nullable().optional(),
  taxType:             z.enum(["inclusive", "overseas"]),
  amount:              z.string().min(1, "金額を入力してください"),
  usageDate:           z.string().min(1, "利用日を入力してください"),
  description:         z.string().min(1, "利用内容を入力してください"),
  supervisorApproved:  z.boolean().optional(),
  supervisorName:      z.string().optional(),
}).superRefine((v, ctx) => {
  const amt = parseInt(v.amount ?? "0", 10);
  if (isNaN(amt) || amt <= 0) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "正しい金額を入力してください" });
  }
  if (v.category === "expense_billable" && !v.billingPartnerName) {
    ctx.addIssue({ code: "custom", path: ["billingPartnerName"], message: "取引先名を入力してください" });
  }
  if (v.supervisorApproved && !v.supervisorName) {
    ctx.addIssue({ code: "custom", path: ["supervisorName"], message: "許可した上司の名前を入力してください" });
  }
});

type F = z.infer<typeof schema>;

export default function ExpenseSubmitPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deptName, setDeptName] = useState<string>("");
  const [deptId, setDeptId] = useState<string>("");

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { taxType: "inclusive", supervisorApproved: false, billingPartnerId: null, billingPartnerName: "" },
  });

  const category         = watch("category");
  const taxType          = watch("taxType");
  const supervisorApproved = watch("supervisorApproved");
  const isBillable       = category === "expense_billable";

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      setDeptId(d.departmentId ?? "");
      setDeptName(d.departmentName ?? "");
    });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]);
    e.target.value = "";
  }

  async function onSubmit(v: F) {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("hasReceipt",         v.hasReceipt);
      fd.append("category",           v.category);
      fd.append("costType",           "onetime"); // 立替経費は常にonetime
      fd.append("taxType",            v.taxType);
      fd.append("amount",             v.amount.replace(/[^0-9]/g, ""));
      fd.append("usageDate",          v.usageDate);
      fd.append("description",        v.description ?? "");
      fd.append("supervisorName",     v.supervisorApproved ? (v.supervisorName ?? "") : "");
      fd.append("billingPartnerName", v.billingPartnerName ?? "");
      fd.append("billingPartnerId",   String(v.billingPartnerId ?? ""));
      fd.append("departmentId",       deptId);
      fd.append("title", buildTitle(v));
      files.forEach(f => fd.append("attachments", f));

      const res = await fetch("/api/reports", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("立替経費申請を提出しました");
      router.push("/employee/history");
    } catch (err: any) {
      toast.error(`提出に失敗しました: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function buildTitle(v: F) {
    const cat = v.category === "expense_billable" ? "立替経費（取引先請求予定）" : "立替経費";
    return `${cat} ${v.usageDate}`.trim();
  }

  const R = <span className="text-red-500 ml-0.5">*</span>;
  const Err = ({ k }: { k: keyof F }) =>
    errors[k] ? <p className="text-xs text-red-500 mt-0.5">{errors[k]?.message as string}</p> : null;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/employee/submit" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">立替経費申請</h1>
          <p className="mt-0.5 text-sm text-gray-500">自身が立替払いした費用の申請</p>
        </div>
      </div>

      {/* 運用ルール */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            <strong>立替経費は自身が立替払いした費用を申請するものです。</strong>
          </p>
          <p className="text-xs">
            ※ 取引先企業にもこの費用を請求する必要がある場合は、種別を<strong>「立替経費（取引先請求予定）」</strong>で申請してください。
          </p>
          <p className="text-xs">
            ※ 交通費は<strong>移動交通費のみ対象</strong>です。通勤交通費は対象外です。
          </p>
          <p className="text-xs">
            ※ 会社カード（黒AMEX・会社AMEX・UPSIDER）での支払いは
            <Link href="/employee/submit/sga" className="underline font-medium">販管費申請</Link>
            をご利用ください。
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">申請情報</CardTitle></CardHeader>
          <CardContent className="space-y-5">

            {/* 領収書・請求書の有無 */}
            <div className="space-y-1">
              <Label>領収書・請求書の有無{R}</Label>
              <Controller name="hasReceipt" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">あり（添付してください）</SelectItem>
                    <SelectItem value="no">なし（後日提出 または 不要）</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              <Err k="hasReceipt" />
            </div>

            {/* 種別 */}
            <div className="space-y-1">
              <Label>種別{R}</Label>
              <Controller name="category" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">立替経費</SelectItem>
                    <SelectItem value="expense_billable">立替経費（取引先請求予定）</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              <Err k="category" />
            </div>

            {/* 取引先（取引先請求予定のみ） */}
            {isBillable && (
              <div className="space-y-1">
                <Label>取引先名（請求先）{R}</Label>
                <Controller name="billingPartnerName" control={control} render={({ field }) => (
                  <PartnerSearch
                    value={{ id: watch("billingPartnerId") ?? null, name: field.value ?? "" }}
                    onChange={v => { field.onChange(v.name); setValue("billingPartnerId", v.id); }}
                    placeholder="取引先名で検索（freeeと連携）"
                  />
                )} />
                <Err k="billingPartnerName" />
              </div>
            )}

            {/* コスト種別（グレーアウト・自動） */}
            <div className="space-y-1">
              <Label>コスト種別</Label>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
                単発費用（立替経費は自動設定）
              </div>
            </div>

            {/* 金額 + 税区分 */}
            <div className="space-y-1">
              <Label>金額（税込）{R}</Label>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                    <Input
                      type="number" min={1} placeholder="例：3500" className="pl-7"
                      {...register("amount")}
                      onBlur={e => setValue("amount", e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </div>
                  <Err k="amount" />
                </div>
                <Controller name="taxType" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">税込（国内）</SelectItem>
                      <SelectItem value="overseas">海外・税なし（対象外）</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              {taxType === "overseas" && (
                <p className="text-xs text-blue-600">freeeへの登録時に税区分「対象外」で登録されます</p>
              )}
            </div>

            {/* 利用日 */}
            <div className="space-y-1">
              <Label>利用日{R}</Label>
              <Input type="date" {...register("usageDate")} />
              <Err k="usageDate" />
            </div>

            {/* 利用内容 */}
            <div className="space-y-1">
              <Label>利用内容{R}</Label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-xs text-gray-400 self-center">例（クリックで入力）：</span>
                {[
                  "移動費用（〇〇訪問のため）不動前→有楽町",
                  "社内ご飯 〇名",
                  "会食（相手先：〇〇会社）",
                ].map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setValue("description", ex)}
                    className="text-xs px-2 py-0.5 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <Textarea
                rows={3}
                placeholder="移動費用（〇〇訪問のため）不動前→有楽町"
                {...register("description")}
              />
              <Err k="description" />
              <p className="text-xs text-gray-400">
                行き先・人数・目的（社内 or 会食）など具体的に記入してください
              </p>
            </div>

            {/* 部門（自動・表示のみ） */}
            <div className="space-y-1">
              <Label>部門</Label>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {deptName || "（未設定 - 岡部が設定します）"}
              </div>
              <p className="text-xs text-gray-400">あなたの所属部門が自動的に設定されます</p>
            </div>

            {/* 上司承認確認 */}
            <div className="space-y-2 rounded-lg border p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4" {...register("supervisorApproved")} />
                <span className="text-sm font-medium">
                  この経費は上司から事前に許可を得ています
                </span>
              </label>
              {supervisorApproved && (
                <div className="space-y-1 mt-2">
                  <Label>許可した上司の名前{R}</Label>
                  <Input placeholder="例：山田 太郎" {...register("supervisorName")} />
                  <Err k="supervisorName" />
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {/* 添付ファイル */}
        <Card>
          <CardHeader><CardTitle className="text-base">添付ファイル</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">領収書・レシートがある場合は添付してください（PDF・画像、最大10MB）</p>
            <label className="flex items-center gap-2 cursor-pointer w-fit rounded-md border border-dashed px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
              <Paperclip className="h-4 w-4" />
              ファイルを選択
              <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFileChange} />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((file, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm">
                    <span className="truncate max-w-xs">{file.name}</span>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-2 text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting} className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            {submitting ? "提出中..." : "申請を提出する"}
          </Button>
        </div>
      </form>
    </div>
  );
}

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
import { Paperclip, X, Send, Info, ArrowLeft } from "lucide-react";
import Link from "next/link";

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "銀行振込" },
  { value: "black_amex",    label: "黒AMEX（安達）" },
  { value: "company_amex",  label: "会社AMEX" },
  { value: "upsider",       label: "UPSIDER（常田・海老根・岡部・菊池）" },
  { value: "other",         label: "その他" },
];

const schema = z.object({
  hasReceipt:         z.enum(["yes", "no"], { error: "選択してください" }),
  category:           z.enum(["sga", "sga_billable"], { error: "種別を選択してください" }),
  billingPartnerName: z.string().optional(),
  billingPartnerId:   z.number().nullable().optional(),
  costType:           z.string().min(1, "コスト種別を選択してください"),
  taxType:            z.enum(["inclusive", "overseas"]),
  amount:             z.string().min(1, "金額を入力してください"),
  description:        z.string().min(1, "利用内容を入力してください"),
  paymentMethod:      z.string().min(1, "支払方法を選択してください"),
  costEndDate:        z.string().optional(),
  recordingMonth:     z.string().min(1, "計上月を入力してください"),
  paymentMonth:       z.string().optional(),
  departmentId:       z.string().optional(),
}).superRefine((v, ctx) => {
  const amt = parseInt(v.amount ?? "0", 10);
  if (isNaN(amt) || amt <= 0) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "正しい金額を入力してください" });
  }
  if (v.category === "sga_billable" && !v.billingPartnerName) {
    ctx.addIssue({ code: "custom", path: ["billingPartnerName"], message: "取引先名を入力してください" });
  }
});

type F = z.infer<typeof schema>;

export default function SgaSubmitPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { taxType: "inclusive", billingPartnerId: null, billingPartnerName: "" },
  });

  const category  = watch("category");
  const taxType   = watch("taxType");
  const costEndDate = watch("costEndDate");
  const isBillable = category === "sga_billable";

  useEffect(() => {
    fetch("/api/departments").then(r => r.json()).then(d => setDepartments(d.departments ?? []));
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
      fd.append("costType",           v.costType);
      fd.append("taxType",            v.taxType);
      fd.append("amount",             v.amount.replace(/[^0-9]/g, ""));
      fd.append("description",        v.description ?? "");
      fd.append("paymentMethod",      v.paymentMethod);
      fd.append("costEndDate",        v.costEndDate ?? "");
      fd.append("recordingMonth",     v.recordingMonth);
      fd.append("paymentMonth",       v.paymentMonth ?? "");
      fd.append("departmentId",       v.departmentId ?? "");
      fd.append("billingPartnerName", v.billingPartnerName ?? "");
      fd.append("billingPartnerId",   String(v.billingPartnerId ?? ""));
      fd.append("title", buildTitle(v));
      files.forEach(f => fd.append("attachments", f));

      const res = await fetch("/api/reports", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("販管費申請を提出しました");
      router.push("/employee/history");
    } catch (err: any) {
      toast.error(`提出に失敗しました: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function buildTitle(v: F) {
    const cat = v.category === "sga_billable" ? "販管費（取引先請求予定）" : "販管費";
    const dateStr = v.recordingMonth.replace(/-/g, "/");
    return `${cat} ${dateStr}`.trim();
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
          <h1 className="text-2xl font-bold">販管費申請</h1>
          <p className="mt-0.5 text-sm text-gray-500">会社が負担する費用の申請</p>
        </div>
      </div>

      {/* 運用ルール */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            販管費は<strong>会社が負担する費用を管理・予測するための申請</strong>です。
            黒AMEX・会社AMEX・UPSIDERなど会社カードでの支払いはこちらで申請してください。
          </p>
          <p className="text-xs">
            契約締結時や費用が発生すると把握した時点で、<strong>できるだけ早く申請</strong>してください。
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
                    <SelectItem value="sga">販管費</SelectItem>
                    <SelectItem value="sga_billable">販管費（取引先請求予定）</SelectItem>
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

            {/* コスト種別 */}
            <div className="space-y-1">
              <Label>コスト種別{R}</Label>
              <Controller name="costType" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running_monthly">月額費用</SelectItem>
                    <SelectItem value="running_annual">年間費用</SelectItem>
                    <SelectItem value="onetime">単発費用</SelectItem>
                  </SelectContent>
                </Select>
              )} />
              <Err k="costType" />
            </div>

            {/* 金額 + 税区分 */}
            <div className="space-y-1">
              <Label>金額（税込）{R}</Label>
              <div className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                    <Input
                      type="number" min={1} placeholder="例：50000" className="pl-7"
                      {...register("amount")}
                      onBlur={e => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setValue("amount", v);
                      }}
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

            {/* 利用内容 */}
            <div className="space-y-1">
              <Label>利用内容{R}</Label>
              <div className="flex flex-wrap gap-1.5 mb-1">
                <span className="text-xs text-gray-400 self-center">例（クリックで入力）：</span>
                {[
                  "〇〇ツール月額利用料",
                  "〇〇サービス年間費用",
                  "社内備品購入（〇〇）",
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
                placeholder="〇〇ツール月額利用料"
                {...register("description")}
              />
              <Err k="description" />
              <p className="text-xs text-gray-400">サービス名・購入品目など、勘定科目の判断に役立つ情報を記入してください</p>
            </div>

            {/* 支払方法 */}
            <div className="space-y-1">
              <Label>支払方法{R}</Label>
              <Controller name="paymentMethod" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              <Err k="paymentMethod" />
            </div>

            {/* 費用発生終了予定 */}
            <div className="space-y-1">
              <Label>費用発生の終了予定</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setValue("costEndDate", costEndDate === "unknown" ? "" : "unknown")}
                  className={costEndDate === "unknown" ? "border-blue-400 text-blue-600 bg-blue-50" : ""}
                >
                  不明
                </Button>
                <Input
                  type="month"
                  className="flex-1"
                  {...register("costEndDate")}
                  disabled={costEndDate === "unknown"}
                />
              </div>
            </div>

            {/* 計上日・支払日 */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>計上日{R}</Label>
                <Input type="date" {...register("recordingMonth")} />
                <p className="text-xs text-gray-400">単発費用以外は月末日を選択してください</p>
                <Err k="recordingMonth" />
              </div>
              <div className="space-y-1">
                <Label>支払日</Label>
                <Input type="date" {...register("paymentMonth")} />
                <p className="text-xs text-gray-400">単発費用以外は月末日を選択してください</p>
              </div>
            </div>

            {/* 部門 */}
            <div className="space-y-1">
              <Label>部門</Label>
              <Controller name="departmentId" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="部門を選択（任意）" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              <p className="text-xs text-gray-400">費用の計上部門がわかる場合のみ入力してください</p>
            </div>

          </CardContent>
        </Card>

        {/* 添付ファイル */}
        <Card>
          <CardHeader><CardTitle className="text-base">添付ファイル</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">領収書・請求書がある場合は添付してください（PDF・画像、最大10MB）</p>
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

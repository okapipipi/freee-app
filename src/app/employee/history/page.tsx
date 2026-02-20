"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:           { label: "下書き",        color: "bg-gray-100 text-gray-600" },
  submitted:       { label: "申請中",        color: "bg-blue-100 text-blue-700" },
  approved:        { label: "承認済み",      color: "bg-green-100 text-green-700" },
  rejected:        { label: "差し戻し",      color: "bg-red-100 text-red-700" },
  synced_to_freee: { label: "freee登録済み", color: "bg-purple-100 text-purple-700" },
  freee_deleted:   { label: "freee削除済",  color: "bg-gray-100 text-gray-500" },
};

const CATEGORY_LABEL: Record<string, string> = {
  expense:          "立替経費",
  expense_billable: "立替経費（請求予定）",
  sga:              "販管費",
  sga_billable:     "販管費（請求予定）",
};

const COST_TYPE_LABEL: Record<string, string> = {
  running_monthly: "月額",
  running_annual:  "年間",
  onetime:         "単発",
};

const UNSET_KEY = "0000-00"; // 支払月未確定グループのキー

type Report = {
  id: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  costType: string;
  recordingMonth: string | null;
  usageDate: string | null;
  dueDate: string | null;
  status: string;
  hasReceipt: boolean;
  createdAt: string;
  attachments: { id: string; fileName: string }[];
};

type MonthGroup = {
  key: string;
  label: string;
  reports: Report[];
  total: number;
  approvedTotal: number;
};

function groupByDueMonth(reports: Report[]): MonthGroup[] {
  const map = new Map<string, Report[]>();

  for (const r of reports) {
    const key = r.dueDate ? r.dueDate.substring(0, 7) : UNSET_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => {
      // 未確定グループは最後
      if (a === UNSET_KEY) return 1;
      if (b === UNSET_KEY) return -1;
      return b.localeCompare(a); // 新しい月が上
    })
    .map(([key, reps]) => {
      let label: string;
      if (key === UNSET_KEY) {
        label = "支払月未確定";
      } else {
        const [year, month] = key.split("-");
        label = `${year}年${parseInt(month)}月払い`;
      }
      const approved = reps.filter(r => r.status === "approved" || r.status === "synced_to_freee");
      return {
        key,
        label,
        reports: reps,
        total:        reps.reduce((s, r) => s + r.amount, 0),
        approvedTotal: approved.reduce((s, r) => s + r.amount, 0),
      };
    });
}

export default function EmployeeHistoryPage() {
  const [reports,  setReports]  = useState<Report[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/reports")
      .then(r => r.json())
      .then(d => {
        const reps: Report[] = d.reports ?? [];
        setReports(reps);
        // 最新の支払月 or 未確定グループを初期展開
        const keys = new Set<string>();
        if (reps.length > 0) {
          const firstKey = reps[0].dueDate ? reps[0].dueDate.substring(0, 7) : UNSET_KEY;
          keys.add(firstKey);
        }
        setOpenKeys(keys);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleMonth(key: string) {
    setOpenKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        読み込み中...
      </div>
    );
  }

  const groups = groupByDueMonth(reports);
  const grandTotal = reports.reduce((s, r) => s + r.amount, 0);
  const approvedGrandTotal = reports
    .filter(r => r.status === "approved" || r.status === "synced_to_freee")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">申請履歴</h1>
          <p className="mt-1 text-sm text-gray-500">全{reports.length}件 · 支払月ごとに表示</p>
        </div>
        <Link href="/employee/submit">
          <Button>新しく申請する</Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border rounded-lg">
          <FileText className="h-10 w-10 mb-3" />
          <p>申請はまだありません</p>
          <Link href="/employee/submit" className="mt-3">
            <Button variant="outline" size="sm">最初の申請を作成する</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 累計サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500 mb-1">申請総額</p>
              <p className="text-xl font-bold">¥{grandTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-green-50 border-green-200 p-4">
              <p className="text-xs text-green-700 mb-1">承認済み総額</p>
              <p className="text-xl font-bold text-green-700">¥{approvedGrandTotal.toLocaleString()}</p>
            </div>
          </div>

          {/* 月別グループ */}
          <div className="space-y-3">
            {groups.map(group => {
              const isOpen  = openKeys.has(group.key);
              const isPending = group.key === UNSET_KEY;
              return (
                <div key={group.key} className="rounded-lg border overflow-hidden">
                  {/* 月ヘッダー */}
                  <button
                    onClick={() => toggleMonth(group.key)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${isPending ? "text-gray-400" : "text-gray-800"}`}>
                        {group.label}
                      </span>
                      <span className="text-sm text-gray-400">{group.reports.length}件</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-sm font-bold ${isPending ? "text-gray-400" : "text-gray-800"}`}>
                          ¥{group.total.toLocaleString()}
                        </div>
                        {group.approvedTotal > 0 && (
                          <div className="text-xs text-green-600">
                            承認済 ¥{group.approvedTotal.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {isOpen
                        ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      }
                    </div>
                  </button>

                  {/* 明細リスト */}
                  {isOpen && (
                    <div className="divide-y">
                      {group.reports.map(report => {
                        const s = STATUS_LABEL[report.status] ?? { label: report.status, color: "bg-gray-100 text-gray-600" };
                        return (
                          <div key={report.id} className="px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {/* タイトル・ステータス */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{report.title}</span>
                                  <Badge className={`text-xs ${s.color} border-0 shrink-0`}>
                                    {s.label}
                                  </Badge>
                                </div>

                                {/* 利用内容 */}
                                {report.description && (
                                  <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                                    {report.description}
                                  </p>
                                )}

                                {/* メタ情報 */}
                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                                  <span>{CATEGORY_LABEL[report.category] ?? report.category}</span>
                                  <span>·</span>
                                  <span>{COST_TYPE_LABEL[report.costType] ?? report.costType}</span>
                                  {(report.usageDate || report.recordingMonth) && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {report.usageDate
                                          ? `利用日: ${report.usageDate}`
                                          : `計上月: ${report.recordingMonth}`}
                                      </span>
                                    </>
                                  )}
                                  {report.dueDate && (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-600">
                                        支払期日: {report.dueDate}
                                      </span>
                                    </>
                                  )}
                                  {report.attachments.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <Paperclip className="h-3 w-3" />
                                        {report.attachments.length}件
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* 金額・申請日 */}
                              <div className="text-right shrink-0">
                                <div className="font-bold text-sm">¥{report.amount.toLocaleString()}</div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {new Date(report.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}申請
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

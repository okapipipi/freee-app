"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Search, RefreshCw, Trash2 } from "lucide-react";

type Report = {
  id: string;
  title: string;
  category: string;
  costType: string;
  amount: number;
  status: string;
  hasReceipt: boolean;
  recordingMonth: string | null;
  usageDate: string | null;
  createdAt: string;
  submitter: { name: string } | null;
  department: { name: string } | null;
  attachments: { id: string }[];
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  submitted:       { label: "申請中",      color: "bg-blue-100 text-blue-700" },
  on_hold:         { label: "確認中",      color: "bg-yellow-100 text-yellow-700" },
  approved:        { label: "承認済",      color: "bg-green-100 text-green-700" },
  rejected:        { label: "却下",        color: "bg-red-100 text-red-700" },
  synced_to_freee: { label: "freee連携済", color: "bg-purple-100 text-purple-700" },
  freee_deleted:   { label: "freee削除済", color: "bg-gray-100 text-gray-500" },
  draft:           { label: "下書き",      color: "bg-gray-100 text-gray-600" },
};

// カテゴリを3グループで色分け
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  sga:              { label: "販管費",              color: "bg-blue-50 text-blue-700 border border-blue-200" },
  sga_billable:     { label: "販管費（請求予定）",  color: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  expense:          { label: "立替経費",             color: "bg-green-50 text-green-700 border border-green-200" },
  expense_billable: { label: "立替経費（請求予定）", color: "bg-teal-50 text-teal-700 border border-teal-200" },
};

const COST_TYPE_LABELS: Record<string, string> = {
  running_monthly: "月額",
  running_annual:  "年間",
  onetime:         "単発",
};

function fmt(n: number) { return "¥" + n.toLocaleString(); }

type TabKey = "submitted" | "on_hold" | "synced_to_freee" | "freee_deleted" | "all";

const TABS: { key: TabKey; label: string; statusParam: string; highlight?: string }[] = [
  { key: "submitted",      label: "申請中",      statusParam: "submitted" },
  { key: "on_hold",        label: "確認中",      statusParam: "on_hold" },
  { key: "synced_to_freee",label: "freee連携済", statusParam: "synced_to_freee", highlight: "purple" },
  { key: "freee_deleted",  label: "freee削除済", statusParam: "freee_deleted",   highlight: "gray" },
  { key: "all",            label: "すべて",      statusParam: "" },
];

export default function AdminReportsPage() {
  const [reports, setReports]       = useState<Report[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState<TabKey>("submitted");
  const [syncing,  setSyncing]      = useState(false);
  const [categoryGroup, setCategoryGroup] = useState("all");
  const [search, setSearch]         = useState("");
  const [searchInput, setSearchInput] = useState("");

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = TABS.find(t => t.key === activeTab)?.statusParam ?? "";
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusParam) p.set("status", statusParam);
      if (categoryGroup !== "all") p.set("categoryGroup", categoryGroup);
      if (search) p.set("search", search);
      const res  = await fetch(`/api/reports?${p}`);
      const data = await res.json();
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, categoryGroup, search]);

  useEffect(() => { load(); }, [load]);

  async function handleSyncDeletions() {
    if (!confirm("freee会計上で削除された取引をチェックして「freee削除済」に更新しますか？\n（連携済み件数によっては時間がかかります）")) return;
    setSyncing(true);
    try {
      const res  = await fetch("/api/admin/sync-freee-deletions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.deleted === 0) {
        alert(`チェック完了（${data.checked}件確認）\nfreeeで削除された取引はありませんでした。`);
      } else {
        alert(`${data.deleted}件がfreee削除済になりました：\n${data.titles.join("\n")}`);
        await load();
      }
    } catch (err: any) {
      alert(`エラー: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">申請一覧・承認</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} 件中 {total === 0 ? 0 : Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} 件表示
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSyncDeletions} disabled={syncing || loading}
          className="text-gray-500 hover:text-red-600">
          <Trash2 className={`h-4 w-4 mr-1 ${syncing ? "animate-pulse" : ""}`} />
          {syncing ? "確認中..." : "freee削除チェック"}
        </Button>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          更新
        </Button>
      </div>

      {/* ステータスタブ */}
      <div className="flex border-b flex-wrap">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const activeColor =
            tab.highlight === "amber"  ? "border-amber-500 text-amber-700" :
            tab.highlight === "purple" ? "border-purple-600 text-purple-700" :
            tab.highlight === "gray"   ? "border-gray-400 text-gray-500" :
            "border-gray-900 text-gray-900";
          const badgeColor =
            tab.highlight === "amber"  ? "bg-amber-500 text-white" :
            tab.highlight === "purple" ? "bg-purple-600 text-white" :
            tab.highlight === "gray"   ? "bg-gray-400 text-white" :
            "bg-gray-900 text-white";
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive ? activeColor : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {isActive && total > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${badgeColor}`}>
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* フィルター行（カテゴリ・検索） */}
      <div className="flex flex-wrap gap-3">
        {/* カテゴリグループ */}
        <Select value={categoryGroup} onValueChange={v => { setCategoryGroup(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カテゴリ</SelectItem>
            <SelectItem value="sga">販管費のみ</SelectItem>
            <SelectItem value="expense">立替経費のみ</SelectItem>
            <SelectItem value="billable">取引先請求予定のみ</SelectItem>
          </SelectContent>
        </Select>

        {/* 検索 */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="申請者名・件名で検索"
              className="pl-8 w-52"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">検索</Button>
        </form>
      </div>

      {/* テーブル */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">申請者</th>
              <th className="px-4 py-3 font-medium text-gray-600">件名</th>
              <th className="px-4 py-3 font-medium text-gray-600">種別</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">金額</th>
              <th className="px-4 py-3 font-medium text-gray-600">日付</th>
              <th className="px-4 py-3 font-medium text-gray-600">ステータス</th>
              <th className="px-4 py-3 font-medium text-gray-600">領収書</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">読み込み中...</td>
              </tr>
            )}
            {!loading && reports.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-gray-400">
                  {activeTab === "submitted"      ? "申請中の申請はありません" :
                   activeTab === "on_hold"         ? "確認中の申請はありません" :
                   activeTab === "synced_to_freee" ? "freee連携済みの申請はありません" :
                   activeTab === "freee_deleted"   ? "freee削除済みの申請はありません" :
                   "申請が見つかりません"}
                </td>
              </tr>
            )}
            {!loading && reports.map(r => {
              const st  = STATUS_META[r.status]   ?? { label: r.status,   color: "bg-gray-100 text-gray-600" };
              const cat = CATEGORY_META[r.category] ?? { label: r.category, color: "bg-gray-100 text-gray-600" };
              const dateStr = r.usageDate ?? r.recordingMonth ?? "";
              const isBillable = r.category === "sga_billable" || r.category === "expense_billable";
              return (
                <tr key={r.id} className={`border-b last:border-0 hover:bg-gray-50 ${isBillable ? "bg-slate-50/50" : ""}`}>
                  <td className="px-4 py-3 text-gray-700">{r.submitter?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    {r.department && (
                      <div className="text-xs text-gray-400">{r.department.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}>
                      {cat.label}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">{COST_TYPE_LABELS[r.costType] ?? r.costType}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.usageDate && (
                      <div className="text-gray-700"><span className="text-gray-400">利用日 </span>{r.usageDate}</div>
                    )}
                    {!r.usageDate && r.recordingMonth && (
                      <div className="text-gray-700"><span className="text-gray-400">計上月 </span>{r.recordingMonth}</div>
                    )}
                    <div className="text-gray-400 mt-0.5"><span>申請 </span>{new Date(r.createdAt).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.hasReceipt ? (
                      <span className="text-xs text-green-600">あり{r.attachments.length > 0 ? `（${r.attachments.length}枚）` : ""}</span>
                    ) : (
                      <span className="text-xs text-amber-600">なし</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/reports/${r.id}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs whitespace-nowrap">
                      詳細<ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>前へ</Button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>次へ</Button>
        </div>
      )}
    </div>
  );
}

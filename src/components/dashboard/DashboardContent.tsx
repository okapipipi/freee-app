"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronLeft, RefreshCw } from "lucide-react";
import type { DashboardData, PlRow, CfRow, RunningRow } from "@/app/api/admin/dashboard/route";

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const fmt = (n: number) => "¥" + n.toLocaleString("ja-JP");

function isPast(monthStr: string): boolean {
  const now = new Date();
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
}

function isCurrent(monthStr: string): boolean {
  const now = new Date();
  const [y, m] = monthStr.split("-").map(Number);
  return y === now.getFullYear() && m - 1 === now.getMonth();
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "未同期";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// PL ツリー表示
// ---------------------------------------------------------------------------
interface PlTree {
  [dept: string]: { [acct: string]: { [partner: string]: { [month: string]: number } } };
}

function buildPlTree(rows: PlRow[]): PlTree {
  const tree: PlTree = {};
  for (const r of rows) {
    if (!tree[r.department]) tree[r.department] = {};
    if (!tree[r.department][r.accountItem]) tree[r.department][r.accountItem] = {};
    if (!tree[r.department][r.accountItem][r.partner]) tree[r.department][r.accountItem][r.partner] = {};
    tree[r.department][r.accountItem][r.partner][r.plMonth] =
      (tree[r.department][r.accountItem][r.partner][r.plMonth] ?? 0) + r.amount;
  }
  return tree;
}

function buildPlTreeForDept(rows: PlRow[], dept: string): PlTree {
  return buildPlTree(rows.filter((r) => r.department === dept));
}

interface PlTableProps {
  rows: PlRow[];
  year: number;
  deptFilter?: string; // undefined = 全体
}

function PlTable({ rows, year, deptFilter }: PlTableProps) {
  const filteredRows = deptFilter ? rows.filter((r) => r.department === deptFilter) : rows;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const tree = deptFilter ? buildPlTreeForDept(filteredRows, deptFilter) : buildPlTree(filteredRows);
  const deptKeys = Object.keys(tree).sort();

  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [openAccts, setOpenAccts] = useState<Set<string>>(new Set());

  const toggleDept = (d: string) =>
    setOpenDepts((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const toggleAcct = (k: string) =>
    setOpenAccts((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const grandByMonth: { [m: string]: number } = {};
  for (const r of filteredRows) grandByMonth[r.plMonth] = (grandByMonth[r.plMonth] ?? 0) + r.amount;
  const grand = Object.values(grandByMonth).reduce((a, b) => a + b, 0);

  if (deptKeys.length === 0) {
    return <div className="py-8 text-center text-gray-400 text-sm">データがありません</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold min-w-[200px]">
              {deptFilter ? "勘定科目 / 取引先" : "部門 / 勘定科目 / 取引先"}
            </th>
            {months.map((m) => (
              <th key={m} className={`px-2 py-2 text-right font-semibold whitespace-nowrap min-w-[72px] text-xs ${isCurrent(m) ? "bg-blue-50" : ""}`}>
                {parseInt(m.split("-")[1], 10)}月
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold min-w-[80px] text-xs">合計</th>
          </tr>
        </thead>
        <tbody>
          {deptKeys.map((dept) => {
            const acctKeys = Object.keys(tree[dept]).sort();
            const deptByMonth: { [m: string]: number } = {};
            for (const acct of acctKeys)
              for (const partner of Object.keys(tree[dept][acct]))
                for (const [m, amt] of Object.entries(tree[dept][acct][partner]))
                  deptByMonth[m] = (deptByMonth[m] ?? 0) + amt;
            const deptTotal = Object.values(deptByMonth).reduce((a, b) => a + b, 0);
            const deptOpen = openDepts.has(dept);

            return (
              <>
                {/* 部門行（deptFilterがない場合のみ） */}
                {!deptFilter && (
                  <tr key={`dept-${dept}`} className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleDept(dept)}>
                    <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-semibold">
                      <span className="flex items-center gap-1">
                        {deptOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                        {dept}
                      </span>
                    </td>
                    {months.map((m) => (
                      <td key={m} className={`px-2 py-2 text-right ${isCurrent(m) ? "bg-blue-50" : ""} ${isPast(m) ? "" : "text-gray-400"}`}>
                        {deptByMonth[m] ? fmt(deptByMonth[m]) : ""}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold">{deptTotal ? fmt(deptTotal) : ""}</td>
                  </tr>
                )}

                {/* 勘定科目行（部門展開時 or deptFilter指定時） */}
                {(deptOpen || deptFilter) && acctKeys.map((acct) => {
                  const acctKey = `${dept}::${acct}`;
                  const partnerKeys = Object.keys(tree[dept][acct]).sort();
                  const acctByMonth: { [m: string]: number } = {};
                  for (const p of partnerKeys)
                    for (const [m, amt] of Object.entries(tree[dept][acct][p]))
                      acctByMonth[m] = (acctByMonth[m] ?? 0) + amt;
                  const acctTotal = Object.values(acctByMonth).reduce((a, b) => a + b, 0);
                  const acctOpen = openAccts.has(acctKey);

                  return (
                    <>
                      <tr key={`acct-${acctKey}`} className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer" onClick={() => toggleAcct(acctKey)}>
                        <td className={`sticky left-0 z-10 bg-white px-3 py-2 ${deptFilter ? "" : "pl-6"}`}>
                          <span className="flex items-center gap-1">
                            {acctOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            {acct}
                          </span>
                        </td>
                        {months.map((m) => (
                          <td key={m} className={`px-2 py-2 text-right ${isCurrent(m) ? "bg-blue-50" : ""} ${isPast(m) ? "" : "text-gray-400"}`}>
                            {acctByMonth[m] ? fmt(acctByMonth[m]) : ""}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">{acctTotal ? fmt(acctTotal) : ""}</td>
                      </tr>

                      {acctOpen && partnerKeys.map((partner) => {
                        const pm = tree[dept][acct][partner];
                        const pTotal = Object.values(pm).reduce((a, b) => a + b, 0);
                        return (
                          <tr key={`partner-${acctKey}-${partner}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className={`sticky left-0 z-10 bg-white px-3 py-2 text-gray-600 ${deptFilter ? "pl-8" : "pl-12"}`}>{partner}</td>
                            {months.map((m) => (
                              <td key={m} className={`px-2 py-2 text-right text-gray-600 ${isCurrent(m) ? "bg-blue-50" : ""} ${isPast(m) ? "" : "text-gray-400"}`}>
                                {pm[m] ? fmt(pm[m]) : ""}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right text-gray-600">{pTotal ? fmt(pTotal) : ""}</td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </>
            );
          })}

          {/* 合計行 */}
          <tr className="border-t-2 border-gray-400 font-bold bg-white">
            <td className="sticky left-0 z-10 bg-white px-3 py-2">合計</td>
            {months.map((m) => (
              <td key={m} className={`px-2 py-2 text-right ${isCurrent(m) ? "bg-blue-50" : ""} ${isPast(m) ? "" : "text-gray-400"}`}>
                {grandByMonth[m] ? fmt(grandByMonth[m]) : ""}
              </td>
            ))}
            <td className="px-3 py-2 text-right">{grand ? fmt(grand) : ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CF テーブル
// ---------------------------------------------------------------------------
interface CfTree {
  [dueMonth: string]: { [partner: string]: CfRow[] };
}

function buildCfTree(rows: CfRow[]): CfTree {
  const tree: CfTree = {};
  for (const r of rows) {
    if (!tree[r.dueMonth]) tree[r.dueMonth] = {};
    if (!tree[r.dueMonth][r.partner]) tree[r.dueMonth][r.partner] = [];
    tree[r.dueMonth][r.partner].push(r);
  }
  return tree;
}

interface CfTableProps {
  rows: CfRow[];
  year: number;
  deptFilter?: string;
}

function CfTable({ rows, year, deptFilter }: CfTableProps) {
  // CF は部門情報がないのでフィルタリング不要（全体タブのみ実績・目標を表示）
  void deptFilter;
  const tree = buildCfTree(rows);
  const monthKeys = Object.keys(tree).sort();
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [openPartners, setOpenPartners] = useState<Set<string>>(new Set());

  const toggleMonth = (m: string) =>
    setOpenMonths((p) => { const n = new Set(p); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const togglePartner = (k: string) =>
    setOpenPartners((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const grandTotal = rows.reduce((a, r) => a + r.amount, 0);

  if (monthKeys.length === 0) {
    return <div className="py-8 text-center text-gray-400 text-sm">データがありません</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="px-3 py-2 text-left font-semibold min-w-[200px]">支払月 / 取引先 / 件名</th>
            <th className="px-3 py-2 text-right font-semibold min-w-[90px]">金額</th>
            <th className="px-3 py-2 text-right font-semibold min-w-[90px]">支払期日</th>
          </tr>
        </thead>
        <tbody>
          {monthKeys.map((dueMonth) => {
            const partnerMap = tree[dueMonth];
            const partnerKeys = Object.keys(partnerMap).sort();
            const monthTotal = Object.values(partnerMap).flat().reduce((a, r) => a + r.amount, 0);
            const monthOpen = openMonths.has(dueMonth);
            const rowBg = isCurrent(dueMonth) ? "bg-blue-50" : "bg-gray-50";

            return (
              <>
                <tr key={`month-${dueMonth}`} className={`border-b border-gray-200 ${rowBg} hover:brightness-95 cursor-pointer`} onClick={() => toggleMonth(dueMonth)}>
                  <td className="px-3 py-2 font-semibold">
                    <span className="flex items-center gap-1">
                      {monthOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      {`${year}年${parseInt(dueMonth.split("-")[1], 10)}月`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(monthTotal)}</td>
                  <td className="px-3 py-2" />
                </tr>

                {monthOpen && partnerKeys.map((partner) => {
                  const pk = `${dueMonth}::${partner}`;
                  const pRows = partnerMap[partner];
                  const pTotal = pRows.reduce((a, r) => a + r.amount, 0);
                  const pOpen = openPartners.has(pk);

                  return (
                    <>
                      <tr key={`partner-${pk}`} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => togglePartner(pk)}>
                        <td className="px-3 py-2 pl-8 text-gray-800">
                          <span className="flex items-center gap-1">
                            {pOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            {partner}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(pTotal)}</td>
                        <td className="px-3 py-2" />
                      </tr>

                      {pOpen && pRows.map((r, i) => (
                        <tr key={`row-${pk}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 pl-14 text-gray-600">{r.title}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{fmt(r.amount)}</td>
                          <td className="px-3 py-2 text-right text-gray-500 text-xs">{r.dueDate}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </>
            );
          })}

          <tr className="border-t-2 border-gray-400 font-bold">
            <td className="px-3 py-2">合計</td>
            <td className="px-3 py-2 text-right">{fmt(grandTotal)}</td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ランニングコスト
// ---------------------------------------------------------------------------
interface RunningTabProps {
  rows: RunningRow[];
  deptFilter?: string;
}

function RunningTab({ rows, deptFilter }: RunningTabProps) {
  const filtered = deptFilter ? rows.filter((r) => r.department === deptFilter) : rows;

  const monthly = filtered.filter((r) => r.costType === "running_monthly");
  const annual = filtered.filter((r) => r.costType === "running_annual");

  const totalMonthly = monthly.reduce((a, r) => a + r.amount, 0);
  const totalAnnual = annual.reduce((a, r) => a + r.amount, 0);

  if (filtered.length === 0) {
    return <div className="py-8 text-center text-gray-400 text-sm">データがありません</div>;
  }

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 mb-1">月額費用合計</p>
            <p className="text-xl font-bold">{fmt(totalMonthly)}<span className="text-sm font-normal text-gray-500">/月</span></p>
            <p className="text-xs text-gray-400 mt-1">年換算: {fmt(totalMonthly * 12)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 mb-1">年間費用合計</p>
            <p className="text-xl font-bold">{fmt(totalAnnual)}<span className="text-sm font-normal text-gray-500">/年</span></p>
          </CardContent>
        </Card>
      </div>

      {/* 月額費用テーブル */}
      {monthly.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">月額費用</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  {!deptFilter && <th className="px-3 py-2 text-left font-semibold">部門</th>}
                  <th className="px-3 py-2 text-left font-semibold">勘定科目</th>
                  <th className="px-3 py-2 text-left font-semibold">取引先・内容</th>
                  <th className="px-3 py-2 text-right font-semibold">金額/月</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    {!deptFilter && <td className="px-3 py-2 text-gray-600">{r.department}</td>}
                    <td className="px-3 py-2">{r.accountItem}</td>
                    <td className="px-3 py-2 text-gray-600">{r.partner}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold">
                  {!deptFilter && <td className="px-3 py-2" />}
                  <td colSpan={2} className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right">{fmt(totalMonthly)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 年間費用テーブル */}
      {annual.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">年間費用</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  {!deptFilter && <th className="px-3 py-2 text-left font-semibold">部門</th>}
                  <th className="px-3 py-2 text-left font-semibold">勘定科目</th>
                  <th className="px-3 py-2 text-left font-semibold">取引先・内容</th>
                  <th className="px-3 py-2 text-right font-semibold">計上月</th>
                  <th className="px-3 py-2 text-right font-semibold">金額</th>
                </tr>
              </thead>
              <tbody>
                {annual.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    {!deptFilter && <td className="px-3 py-2 text-gray-600">{r.department}</td>}
                    <td className="px-3 py-2">{r.accountItem}</td>
                    <td className="px-3 py-2 text-gray-600">{r.partner}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{r.recordingMonth}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 font-bold">
                  {!deptFilter && <td className="px-3 py-2" />}
                  <td colSpan={3} className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right">{fmt(totalAnnual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PL セクション（実績 + 目標の2段構成）
// ---------------------------------------------------------------------------
interface PlSectionProps {
  jitsuRows: PlRow[];
  mokuhyoRows: PlRow[];
  year: number;
  deptFilter?: string;
}

function PlSection({ jitsuRows, mokuhyoRows, year, deptFilter }: PlSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          実績（freee確定データ）
        </h3>
        <PlTable rows={jitsuRows} year={year} deptFilter={deptFilter} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
          目標（申請ベース）
        </h3>
        <PlTable rows={mokuhyoRows} year={year} deptFilter={deptFilter} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CF セクション（実績 + 目標）
// ---------------------------------------------------------------------------
interface CfSectionProps {
  jitsuRows: CfRow[];
  mokuhyoRows: CfRow[];
  year: number;
  deptFilter?: string;
}

function CfSection({ jitsuRows, mokuhyoRows, year, deptFilter }: CfSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          実績（freee確定データ）
        </h3>
        <CfTable rows={jitsuRows} year={year} deptFilter={deptFilter} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
          目標（申請ベース）
        </h3>
        <CfTable rows={mokuhyoRows} year={year} deptFilter={deptFilter} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
const DEPT_TABS = ["全体", "営業代行", "Salesforce", "Corporate", "AIDOG", "人材紹介"] as const;
type MainTab = "pl" | "cf" | "running";

interface DashboardContentProps {
  title: string;
}

export function DashboardContent({ title }: DashboardContentProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [mainTab, setMainTab] = useState<MainTab>("pl");
  const [deptTab, setDeptTab] = useState<string>("全体");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/dashboard?year=${year}`)
      .then((res) => {
        if (!res.ok) throw new Error("データの取得に失敗しました");
        return res.json() as Promise<DashboardData>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-freee-pl", { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "同期に失敗しました");
      }
      fetchData();
    } catch (err: any) {
      alert(`同期エラー: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const availableYears = data?.availableYears ?? [currentYear];
  const canPrev = year > Math.min(...availableYears);
  const canNext = year < Math.max(...availableYears);

  // 部門タブ（データにある部門 + 固定タブ）
  const dynamicDepts = data?.departments ?? [];
  const deptTabs = ["全体", ...DEPT_TABS.filter((d) => d !== "全体" || dynamicDepts.includes(d))];

  const deptFilter = deptTab === "全体" ? undefined : deptTab;

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 最終同期日時 + 更新ボタン */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              freee最終同期: {data ? formatSyncedAt(data.lastPlSyncAt) : "..."}
            </span>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              今すぐ更新
            </Button>
          </div>

          {/* 年ナビゲーション */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y - 1)} disabled={!canPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[56px] text-center font-semibold text-sm">{year}年</span>
            <Button variant="outline" size="sm" onClick={() => setYear((y) => y + 1)} disabled={!canNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 部門タブ */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {deptTabs.map((dept) => (
          <button
            key={dept}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              deptTab === dept
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setDeptTab(dept)}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* メインタブ */}
      <div className="flex gap-2 border-b border-gray-200">
        {([["pl", "PL（損益計算書）"], ["cf", "CF（資金繰り）"], ["running", "ランニングコスト"]] as const).map(([tab, label]) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              mainTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setMainTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {year}年{" "}
            {deptTab !== "全体" ? `${deptTab} / ` : ""}
            {mainTab === "pl" ? "PL集計" : mainTab === "cf" ? "CF集計" : "ランニングコスト"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="py-12 text-center text-gray-400">読み込み中...</div>}
          {error && <div className="py-12 text-center text-red-500">{error}</div>}
          {!loading && !error && data && (
            <>
              {mainTab === "pl" && (
                <PlSection
                  jitsuRows={data.jitsuPlRows}
                  mokuhyoRows={data.mokuhyoPlRows}
                  year={year}
                  deptFilter={deptFilter}
                />
              )}
              {mainTab === "cf" && (
                <CfSection
                  jitsuRows={data.jitsuCfRows}
                  mokuhyoRows={data.mokuhyoCfRows}
                  year={year}
                  deptFilter={deptFilter}
                />
              )}
              {mainTab === "running" && (
                <RunningTab
                  rows={data.runningRows}
                  deptFilter={deptFilter}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface PlRow {
  department: string;
  accountItem: string;
  partner: string;
  plMonth: string; // YYYY-MM
  amount: number;
  category: string;
}

interface CfRow {
  dueMonth: string; // YYYY-MM
  employee: string;
  title: string;
  amount: number;
  dueDate: string;
  category: string;
}

interface DashboardData {
  plRows: PlRow[];
  cfRows: CfRow[];
  availableYears: number[];
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const formatAmount = (n: number) => "¥" + n.toLocaleString("ja-JP");

function monthLabel(year: number, monthStr: string): string {
  const m = parseInt(monthStr.split("-")[1], 10);
  return `${year}年${m}月`;
}

function isPast(monthStr: string): boolean {
  const now = new Date();
  const [y, m] = monthStr.split("-").map(Number);
  const month = new Date(y, m - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return month < thisMonth;
}

function isCurrent(monthStr: string): boolean {
  const now = new Date();
  const [y, m] = monthStr.split("-").map(Number);
  return y === now.getFullYear() && m - 1 === now.getMonth();
}

// ---------------------------------------------------------------------------
// PL タブ
// ---------------------------------------------------------------------------

// ツリー構造: 部門 > 勘定科目 > 取引先/社員
interface PlTree {
  [dept: string]: {
    [acct: string]: {
      [partner: string]: { [month: string]: number };
    };
  };
}

function buildPlTree(rows: PlRow[]): PlTree {
  const tree: PlTree = {};
  for (const r of rows) {
    if (!tree[r.department]) tree[r.department] = {};
    if (!tree[r.department][r.accountItem])
      tree[r.department][r.accountItem] = {};
    if (!tree[r.department][r.accountItem][r.partner])
      tree[r.department][r.accountItem][r.partner] = {};
    const prev =
      tree[r.department][r.accountItem][r.partner][r.plMonth] ?? 0;
    tree[r.department][r.accountItem][r.partner][r.plMonth] =
      prev + r.amount;
  }
  return tree;
}

interface PlTabProps {
  rows: PlRow[];
  year: number;
}

function PlTab({ rows, year }: PlTabProps) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${year}-${m}`;
  });

  const tree = buildPlTree(rows);
  const deptKeys = Object.keys(tree).sort();

  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [openAccts, setOpenAccts] = useState<Set<string>>(new Set());

  const toggleDept = (dept: string) => {
    setOpenDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const toggleAcct = (key: string) => {
    setOpenAccts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grandTotalByMonth: { [month: string]: number } = {};
  for (const r of rows) {
    grandTotalByMonth[r.plMonth] =
      (grandTotalByMonth[r.plMonth] ?? 0) + r.amount;
  }
  const grandTotal = Object.values(grandTotalByMonth).reduce(
    (a, b) => a + b,
    0
  );

  if (deptKeys.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        データがありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold min-w-[220px]">
              部門 / 勘定科目 / 取引先
            </th>
            {months.map((m) => (
              <th
                key={m}
                className={`px-3 py-2 text-right font-semibold whitespace-nowrap min-w-[80px] ${
                  isCurrent(m) ? "bg-blue-50" : ""
                }`}
              >
                {parseInt(m.split("-")[1], 10)}月
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap min-w-[90px]">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {deptKeys.map((dept) => {
            const acctKeys = Object.keys(tree[dept]).sort();
            const deptByMonth: { [m: string]: number } = {};
            for (const acct of acctKeys) {
              for (const partner of Object.keys(tree[dept][acct])) {
                for (const [month, amt] of Object.entries(
                  tree[dept][acct][partner]
                )) {
                  deptByMonth[month] = (deptByMonth[month] ?? 0) + amt;
                }
              }
            }
            const deptTotal = Object.values(deptByMonth).reduce(
              (a, b) => a + b,
              0
            );
            const deptOpen = openDepts.has(dept);

            return (
              <PlDeptRows
                key={`dept-${dept}`}
                dept={dept}
                acctKeys={acctKeys}
                tree={tree}
                deptByMonth={deptByMonth}
                deptTotal={deptTotal}
                deptOpen={deptOpen}
                openAccts={openAccts}
                months={months}
                onToggleDept={toggleDept}
                onToggleAcct={toggleAcct}
              />
            );
          })}

          {/* 合計行 */}
          <tr className="border-t-2 border-gray-400 font-bold bg-white">
            <td className="sticky left-0 z-10 bg-white px-3 py-2">
              合計
            </td>
            {months.map((m) => {
              const val = grandTotalByMonth[m] ?? 0;
              return (
                <td
                  key={m}
                  className={`px-3 py-2 text-right ${
                    isCurrent(m) ? "bg-blue-50" : ""
                  } ${isPast(m) ? "" : "text-gray-400"}`}
                >
                  {val !== 0 ? formatAmount(val) : ""}
                </td>
              );
            })}
            <td className="px-3 py-2 text-right">
              {grandTotal !== 0 ? formatAmount(grandTotal) : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// 部門レベルの行群を Fragment でまとめるサブコンポーネント
interface PlDeptRowsProps {
  dept: string;
  acctKeys: string[];
  tree: PlTree;
  deptByMonth: { [m: string]: number };
  deptTotal: number;
  deptOpen: boolean;
  openAccts: Set<string>;
  months: string[];
  onToggleDept: (dept: string) => void;
  onToggleAcct: (key: string) => void;
}

function PlDeptRows({
  dept,
  acctKeys,
  tree,
  deptByMonth,
  deptTotal,
  deptOpen,
  openAccts,
  months,
  onToggleDept,
  onToggleAcct,
}: PlDeptRowsProps) {
  return (
    <>
      {/* 部門行 */}
      <tr
        className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer"
        onClick={() => onToggleDept(dept)}
      >
        <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-semibold">
          <span className="flex items-center gap-1">
            {deptOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            {dept}
          </span>
        </td>
        {months.map((m) => {
          const val = deptByMonth[m] ?? 0;
          return (
            <td
              key={m}
              className={`px-3 py-2 text-right ${
                isCurrent(m) ? "bg-blue-50" : ""
              } ${isPast(m) ? "" : "text-gray-400"}`}
            >
              {val !== 0 ? formatAmount(val) : ""}
            </td>
          );
        })}
        <td className="px-3 py-2 text-right font-semibold">
          {deptTotal !== 0 ? formatAmount(deptTotal) : ""}
        </td>
      </tr>

      {/* 勘定科目行（部門展開時のみ） */}
      {deptOpen &&
        acctKeys.map((acct) => {
          const acctKey = `${dept}::${acct}`;
          const partnerKeys = Object.keys(tree[dept][acct]).sort();
          const acctByMonth: { [m: string]: number } = {};
          for (const partner of partnerKeys) {
            for (const [month, amt] of Object.entries(
              tree[dept][acct][partner]
            )) {
              acctByMonth[month] = (acctByMonth[month] ?? 0) + amt;
            }
          }
          const acctTotal = Object.values(acctByMonth).reduce(
            (a, b) => a + b,
            0
          );
          const acctOpen = openAccts.has(acctKey);

          return (
            <PlAcctRows
              key={`acct-${acctKey}`}
              dept={dept}
              acct={acct}
              acctKey={acctKey}
              partnerKeys={partnerKeys}
              tree={tree}
              acctByMonth={acctByMonth}
              acctTotal={acctTotal}
              acctOpen={acctOpen}
              months={months}
              onToggleAcct={onToggleAcct}
            />
          );
        })}
    </>
  );
}

// 勘定科目レベルの行群を Fragment でまとめるサブコンポーネント
interface PlAcctRowsProps {
  dept: string;
  acct: string;
  acctKey: string;
  partnerKeys: string[];
  tree: PlTree;
  acctByMonth: { [m: string]: number };
  acctTotal: number;
  acctOpen: boolean;
  months: string[];
  onToggleAcct: (key: string) => void;
}

function PlAcctRows({
  dept,
  acct,
  acctKey,
  partnerKeys,
  tree,
  acctByMonth,
  acctTotal,
  acctOpen,
  months,
  onToggleAcct,
}: PlAcctRowsProps) {
  return (
    <>
      {/* 勘定科目行 */}
      <tr
        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
        onClick={() => onToggleAcct(acctKey)}
      >
        <td className="sticky left-0 z-10 bg-white px-3 py-2 pl-6">
          <span className="flex items-center gap-1">
            {acctOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            {acct}
          </span>
        </td>
        {months.map((m) => {
          const val = acctByMonth[m] ?? 0;
          return (
            <td
              key={m}
              className={`px-3 py-2 text-right ${
                isCurrent(m) ? "bg-blue-50" : ""
              } ${isPast(m) ? "" : "text-gray-400"}`}
            >
              {val !== 0 ? formatAmount(val) : ""}
            </td>
          );
        })}
        <td className="px-3 py-2 text-right">
          {acctTotal !== 0 ? formatAmount(acctTotal) : ""}
        </td>
      </tr>

      {/* 取引先/社員行（勘定科目展開時のみ） */}
      {acctOpen &&
        partnerKeys.map((partner) => {
          const partnerMap = tree[dept][acct][partner];
          const partnerTotal = Object.values(partnerMap).reduce(
            (a, b) => a + b,
            0
          );
          return (
            <tr
              key={`partner-${acctKey}-${partner}`}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="sticky left-0 z-10 bg-white px-3 py-2 pl-12 text-gray-700">
                {partner}
              </td>
              {months.map((m) => {
                const val = partnerMap[m] ?? 0;
                return (
                  <td
                    key={m}
                    className={`px-3 py-2 text-right ${
                      isCurrent(m) ? "bg-blue-50" : ""
                    } ${isPast(m) ? "" : "text-gray-400"}`}
                  >
                    {val !== 0 ? formatAmount(val) : ""}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right text-gray-700">
                {partnerTotal !== 0 ? formatAmount(partnerTotal) : ""}
              </td>
            </tr>
          );
        })}
    </>
  );
}

// ---------------------------------------------------------------------------
// CF タブ
// ---------------------------------------------------------------------------

interface CfTree {
  [dueMonth: string]: {
    [employee: string]: CfRow[];
  };
}

function buildCfTree(rows: CfRow[]): CfTree {
  const tree: CfTree = {};
  for (const r of rows) {
    if (!tree[r.dueMonth]) tree[r.dueMonth] = {};
    if (!tree[r.dueMonth][r.employee]) tree[r.dueMonth][r.employee] = [];
    tree[r.dueMonth][r.employee].push(r);
  }
  return tree;
}

interface CfTabProps {
  rows: CfRow[];
  year: number;
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case "expense":
      return "経費";
    case "expense_billable":
      return "立替経費";
    case "sga":
      return "SGA";
    case "sga_billable":
      return "SGA（請求可）";
    default:
      return cat;
  }
}

function CfTab({ rows, year }: CfTabProps) {
  const tree = buildCfTree(rows);
  const monthKeys = Object.keys(tree).sort();

  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [openEmployees, setOpenEmployees] = useState<Set<string>>(new Set());

  const toggleMonth = (m: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const toggleEmployee = (key: string) => {
    setOpenEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grandTotal = rows.reduce((a, r) => a + r.amount, 0);

  if (monthKeys.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        データがありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="px-3 py-2 text-left font-semibold min-w-[200px]">
              支払月 / 社員 / 件名
            </th>
            <th className="px-3 py-2 text-left font-semibold min-w-[100px]">
              カテゴリ
            </th>
            <th className="px-3 py-2 text-right font-semibold min-w-[100px]">
              金額
            </th>
            <th className="px-3 py-2 text-right font-semibold min-w-[100px]">
              支払期日
            </th>
          </tr>
        </thead>
        <tbody>
          {monthKeys.map((dueMonth) => {
            const employees = tree[dueMonth];
            const employeeKeys = Object.keys(employees).sort();
            const monthTotal = Object.values(employees)
              .flat()
              .reduce((a, r) => a + r.amount, 0);
            const monthOpen = openMonths.has(dueMonth);

            return (
              <CfMonthRows
                key={`month-${dueMonth}`}
                dueMonth={dueMonth}
                year={year}
                employees={employees}
                employeeKeys={employeeKeys}
                monthTotal={monthTotal}
                monthOpen={monthOpen}
                openEmployees={openEmployees}
                onToggleMonth={toggleMonth}
                onToggleEmployee={toggleEmployee}
              />
            );
          })}

          {/* 合計行 */}
          <tr className="border-t-2 border-gray-400 font-bold">
            <td className="px-3 py-2">合計</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right">
              {formatAmount(grandTotal)}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

interface CfMonthRowsProps {
  dueMonth: string;
  year: number;
  employees: { [employee: string]: CfRow[] };
  employeeKeys: string[];
  monthTotal: number;
  monthOpen: boolean;
  openEmployees: Set<string>;
  onToggleMonth: (m: string) => void;
  onToggleEmployee: (key: string) => void;
}

function CfMonthRows({
  dueMonth,
  year,
  employees,
  employeeKeys,
  monthTotal,
  monthOpen,
  openEmployees,
  onToggleMonth,
  onToggleEmployee,
}: CfMonthRowsProps) {
  const rowBg = isCurrent(dueMonth) ? "bg-blue-50" : "bg-gray-50";

  return (
    <>
      {/* 支払月行 */}
      <tr
        className={`border-b border-gray-200 ${rowBg} hover:brightness-95 cursor-pointer`}
        onClick={() => onToggleMonth(dueMonth)}
      >
        <td className="px-3 py-2 font-semibold">
          <span className="flex items-center gap-1">
            {monthOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            {monthLabel(year, dueMonth)}
          </span>
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-right font-semibold">
          {formatAmount(monthTotal)}
        </td>
        <td className="px-3 py-2" />
      </tr>

      {/* 社員行（月展開時のみ） */}
      {monthOpen &&
        employeeKeys.map((employee) => {
          const empKey = `${dueMonth}::${employee}`;
          const empRows = employees[employee];
          const empTotal = empRows.reduce((a, r) => a + r.amount, 0);
          const empOpen = openEmployees.has(empKey);

          return (
            <CfEmployeeRows
              key={`emp-${empKey}`}
              employee={employee}
              empKey={empKey}
              empRows={empRows}
              empTotal={empTotal}
              empOpen={empOpen}
              onToggleEmployee={onToggleEmployee}
            />
          );
        })}
    </>
  );
}

interface CfEmployeeRowsProps {
  employee: string;
  empKey: string;
  empRows: CfRow[];
  empTotal: number;
  empOpen: boolean;
  onToggleEmployee: (key: string) => void;
}

function CfEmployeeRows({
  employee,
  empKey,
  empRows,
  empTotal,
  empOpen,
  onToggleEmployee,
}: CfEmployeeRowsProps) {
  return (
    <>
      {/* 社員行 */}
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => onToggleEmployee(empKey)}
      >
        <td className="px-3 py-2 pl-8 text-gray-800">
          <span className="flex items-center gap-1">
            {empOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0" />
            )}
            {employee}
          </span>
        </td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-right">{formatAmount(empTotal)}</td>
        <td className="px-3 py-2" />
      </tr>

      {/* 申請一覧（社員展開時のみ） */}
      {empOpen &&
        empRows.map((r, i) => (
          <tr
            key={`row-${empKey}-${i}`}
            className="border-b border-gray-100 hover:bg-gray-50"
          >
            <td className="px-3 py-2 pl-16 text-gray-600">{r.title}</td>
            <td className="px-3 py-2 text-gray-500 text-xs">
              {categoryLabel(r.category)}
            </td>
            <td className="px-3 py-2 text-right text-gray-700">
              {formatAmount(r.amount)}
            </td>
            <td className="px-3 py-2 text-right text-gray-500 text-xs">
              {r.dueDate}
            </td>
          </tr>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------
interface DashboardContentProps {
  title: string;
}

export function DashboardContent({ title }: DashboardContentProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState<"pl" | "cf">("pl");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/dashboard?year=${year}`)
      .then((res) => {
        if (!res.ok) throw new Error("データの取得に失敗しました");
        return res.json();
      })
      .then((json: DashboardData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year]);

  const availableYears = data?.availableYears ?? [];

  const canPrev =
    availableYears.length > 0
      ? year > Math.min(...availableYears)
      : false;
  const canNext =
    availableYears.length > 0
      ? year < Math.max(...availableYears)
      : false;

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>

        {/* 年ナビゲーション */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setYear((y) => y - 1)}
            disabled={!canPrev}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="min-w-[60px] text-center font-semibold">
            {year}年
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setYear((y) => y + 1)}
            disabled={!canNext}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pl"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("pl")}
        >
          PL（損益計算書）
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cf"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("cf")}
        >
          CF（キャッシュフロー）
        </button>
      </div>

      {/* コンテンツ */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "pl"
              ? `${year}年 PL集計`
              : `${year}年 CF集計`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="py-12 text-center text-gray-500">
              読み込み中...
            </div>
          )}
          {error && (
            <div className="py-12 text-center text-red-500">{error}</div>
          )}
          {!loading && !error && data && (
            <>
              {activeTab === "pl" && (
                <PlTab rows={data.plRows} year={year} />
              )}
              {activeTab === "cf" && (
                <CfTab rows={data.cfRows} year={year} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

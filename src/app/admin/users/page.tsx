"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PartnerSearch } from "@/components/ui/partner-search";
import { RefreshCw, UserPlus, Pencil, Mail } from "lucide-react";

type Dept = { id: string; name: string };

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isHidden: boolean;
  mustChangePassword: boolean;
  freeePartnerId: number | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  invitedAt: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin:     "管理者",
  employee:  "社員",
  executive: "経営陣",
  intern:    "インターン",
};

const ROLE_COLORS: Record<string, string> = {
  admin:     "bg-purple-100 text-purple-700",
  employee:  "bg-blue-100 text-blue-700",
  executive: "bg-orange-100 text-orange-700",
  intern:    "bg-green-100 text-green-700",
};

const DEFAULT_PASSWORD = "digiman1007";

type TabKey = "all" | "management" | "employee" | "intern" | "retired";

type FormState = {
  name:           string;
  email:          string;
  password:       string;
  role:           string;
  departmentId:   string;
  freeePartnerId: number | null;
  isActive:       boolean;
};

const emptyForm = (): FormState => ({
  name: "", email: "", password: DEFAULT_PASSWORD, role: "employee",
  departmentId: "", freeePartnerId: null, isActive: true,
});

export default function AdminUsersPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabKey>("all");
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<User | null>(null);
  const [form,        setForm]        = useState<FormState>(emptyForm());
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [googleCandidates,  setGoogleCandidates]  = useState<{ name: string; email: string }[]>([]);
  const [googleSearching,   setGoogleSearching]   = useState(false);
  const [googleStatus,      setGoogleStatus]      = useState<"idle"|"notConfigured"|"notFound"|"ok">("idle");
  const googleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/departments"),
      ]);
      const uData = await uRes.json();
      const dData = await dRes.json();
      setUsers(uData.users ?? []);
      setDepartments(dData.departments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setError("");
    setGoogleStatus("idle");
    setGoogleCandidates([]);
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setForm({
      name:           u.name,
      email:          u.email,
      password:       "",
      role:           u.role,
      departmentId:   u.departmentId ?? "",
      freeePartnerId: u.freeePartnerId,
      isActive:       u.isActive,
    });
    setError("");
    setDialogOpen(true);
  }

  async function handleCreateNewPartner(name: string) {
    const res = await fetch("/api/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "取引先の作成に失敗しました");
      return;
    }
    // 作成成功 → handlePartnerSelectと同じ後続処理を実行
    await handlePartnerSelect({ id: data.partner.id, name: data.partner.name });
  }

  async function handlePartnerSelect(v: { id: number | null; name: string }) {
    setForm(f => ({ ...f, name: v.name, freeePartnerId: v.id }));
    setGoogleCandidates([]);
    setGoogleStatus("idle");

    if (!v.id || !v.name) return;

    clearTimeout(googleTimer.current);
    setGoogleSearching(true);
    try {
      const res  = await fetch(`/api/admin/google-users?q=${encodeURIComponent(v.name)}`);
      const data = await res.json();

      if (data.notConfigured) { setGoogleStatus("notConfigured"); return; }

      const users: { name: string; email: string }[] = data.users ?? [];
      if (users.length === 1) {
        setForm(f => ({ ...f, name: users[0].name, freeePartnerId: v.id, email: users[0].email }));
        setGoogleStatus("ok");
      } else if (users.length > 1) {
        setGoogleCandidates(users);
        setGoogleStatus("ok");
      } else {
        setGoogleStatus("notFound");
      }
    } finally {
      setGoogleSearching(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.email) { setError("名前とメールアドレスは必須です"); return; }
    if (!editTarget && !form.password) { setError("新規作成時はパスワードが必須です"); return; }

    setSaving(true);
    setError("");
    try {
      const body = {
        name:           form.name,
        email:          form.email,
        role:           form.role,
        departmentId:   form.departmentId || null,
        freeePartnerId: form.freeePartnerId,
        isActive:       form.isActive,
        ...(form.password ? { password: form.password } : {}),
      };

      const res = editTarget
        ? await fetch(`/api/admin/users/${editTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "保存に失敗しました"); return; }

      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    await load();
  }

  async function sendInvite(u: User) {
    if (!confirm(`${u.name} に招待メールを送信します。よろしいですか？`)) return;
    const res = await fetch(`/api/admin/users/${u.id}/invite`, { method: "POST" });
    if (res.ok) {
      alert(`${u.name} に招待メールを送信しました。`);
      await load();
    } else {
      alert("送信に失敗しました。Resend設定を確認してください。");
    }
  }

  async function resetPassword(u: User) {
    if (!confirm(`${u.name} のパスワードを "digiman1007" にリセットします。よろしいですか？`)) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "digiman1007", mustChangePassword: true }),
    });
    await load();
  }

  async function retire(u: User) {
    if (!confirm(`${u.name} を退職者として処理します。ログインできなくなります。よろしいですか？`)) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: true, isActive: false }),
    });
    await load();
  }

  async function unretire(u: User) {
    if (!confirm(`${u.name} を復職させます。ログイン可能に戻ります。よろしいですか？`)) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: false, isActive: true }),
    });
    await load();
  }

  // タブフィルター
  const tabFilter = (u: User) => {
    if (activeTab === "retired")    return u.isHidden;
    if (u.isHidden)                 return false; // 退職者は退職タブ以外に出さない
    if (activeTab === "management") return u.role === "executive" || u.role === "admin";
    if (activeTab === "employee")   return u.role === "employee";
    if (activeTab === "intern")     return u.role === "intern";
    return true; // "all"
  };
  const visibleUsers = users.filter(tabFilter);

  const active = users.filter(u => !u.isHidden);
  const tabCounts: Record<TabKey, number> = {
    all:        active.length,
    management: active.filter(u => u.role === "executive" || u.role === "admin").length,
    employee:   active.filter(u => u.role === "employee").length,
    intern:     active.filter(u => u.role === "intern").length,
    retired:    users.filter(u => u.isHidden).length,
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: "all",        label: "全体" },
    { key: "management", label: "経営陣・管理者" },
    { key: "employee",   label: "社員" },
    { key: "intern",     label: "インターン" },
    { key: "retired",    label: "退職者" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <p className="mt-0.5 text-sm text-gray-500">{active.length} 名</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />更新
          </Button>
          <Button size="sm" onClick={openCreate}>
            <UserPlus className="h-4 w-4 mr-1" />社員を招待
          </Button>
        </div>
      </div>

      {/* ロールタブ */}
      <div className="flex border-b">
        {TABS.map(tab => {
          const isRetired = tab.key === "retired";
          const isActive  = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? isRetired
                    ? "border-red-500 text-red-600"
                    : "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                isActive
                  ? isRetired ? "bg-red-500 text-white" : "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-left">
              <th className="px-4 py-3 font-medium text-gray-600">名前</th>
              <th className="px-4 py-3 font-medium text-gray-600">メールアドレス</th>
              <th className="px-4 py-3 font-medium text-gray-600">ロール</th>
              <th className="px-4 py-3 font-medium text-gray-600">部門</th>
              <th className="px-4 py-3 font-medium text-gray-600">freee取引先ID</th>
              <th className="px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="px-4 py-3 font-medium text-gray-600">招待</th>
              <th className="px-4 py-3 font-medium text-gray-600">パスワード</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">読み込み中...</td></tr>
            )}
            {!loading && visibleUsers.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">
                {activeTab === "retired" ? "退職者はいません" : "ユーザーがいません"}
              </td></tr>
            )}
            {!loading && visibleUsers.map(u => (
              <tr key={u.id} className={`border-b last:border-0 hover:bg-gray-50 ${!u.isActive && !u.isHidden ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{u.department?.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">{u.freeePartnerId ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3">
                  {u.isHidden ? (
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                      退職済
                    </span>
                  ) : (
                    <button
                      onClick={() => toggleActive(u)}
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {u.isActive ? "有効" : "無効"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.invitedAt ? (
                    <span className="inline-block text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {new Date(u.invitedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}送信済
                    </span>
                  ) : (
                    <span className="inline-block text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                      未送信
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {(u.role === "employee" || u.role === "intern") && !u.isHidden && (
                    <div className="flex items-center gap-2">
                      {u.mustChangePassword ? (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          初期PW
                        </span>
                      ) : (
                        <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          変更済
                        </span>
                      )}
                      <button
                        onClick={() => resetPassword(u)}
                        className="text-xs text-gray-400 hover:text-red-500 underline"
                      >
                        リセット
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.isHidden ? (
                    // 退職者タブ：復職ボタンのみ
                    <Button variant="ghost" size="sm" onClick={() => unretire(u)} className="text-blue-500 hover:text-blue-700">
                      復職
                    </Button>
                  ) : (
                    // 通常タブ：編集・招待・退職
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />編集
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => sendInvite(u)} className="text-blue-500 hover:text-blue-700">
                        <Mail className="h-3.5 w-3.5 mr-1" />招待
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => retire(u)} className="text-red-400 hover:text-red-600">
                        退職
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 追加 / 編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "ユーザーを編集" : "社員を招待"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

            <div className="space-y-1">
              <Label>
                freee取引先で検索
                <span className="ml-1 text-xs text-gray-400">（選択すると名前・メールが自動入力されます）</span>
              </Label>
              <PartnerSearch
                value={{ id: form.freeePartnerId, name: form.name }}
                onChange={handlePartnerSelect}
                onCreateNew={handleCreateNewPartner}
                placeholder="社員名で検索..."
              />
              {googleSearching && (
                <p className="text-xs text-gray-400">Googleアカウントを検索中...</p>
              )}
              {!googleSearching && googleStatus === "notFound" && (
                <p className="text-xs text-amber-600">
                  Googleアカウントが見つかりませんでした。手動でメールアドレスを入力してください
                </p>
              )}
              {googleCandidates.length > 1 && (
                <div className="rounded-md border bg-gray-50 p-2 space-y-1">
                  <p className="text-xs text-gray-500 mb-1">複数のGoogleアカウントが見つかりました。選択してください：</p>
                  {googleCandidates.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, name: u.name, email: u.email }));
                        setGoogleCandidates([]);
                      }}
                      className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                    >
                      <span className="font-medium">{u.name}</span>
                      <span className="ml-2 text-gray-500">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>名前 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="山田 太郎"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>メールアドレス <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                placeholder="yamada@digi-man.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>
                パスワード
                {!editTarget && <span className="text-red-500"> *</span>}
                {editTarget && <span className="ml-1 text-xs text-gray-400">（変更する場合のみ入力）</span>}
              </Label>
              <Input
                type="password"
                placeholder={editTarget ? "変更しない場合は空白" : "初期パスワード"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>ロール</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">社員</SelectItem>
                  <SelectItem value="intern">インターン</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                  <SelectItem value="executive">経営陣</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>部門</Label>
              <Select
                value={form.departmentId || "__none__"}
                onValueChange={v => setForm(f => ({ ...f, departmentId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="部門を選択" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">未設定</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editTarget && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="h-4 w-4"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <Label htmlFor="isActive" className="cursor-pointer">有効（ログイン可）</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (editTarget ? "保存中..." : "送信中...") : editTarget ? "保存" : "招待メールを送信"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

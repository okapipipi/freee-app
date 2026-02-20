"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function PasswordPage() {
  const router = useRouter();

  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");
  const [done,            setDone]            = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "変更に失敗しました");
        return;
      }

      setDone(true);
      setTimeout(async () => {
        await authClient.signOut();
        router.push("/login");
      }, 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-xl font-bold">パスワード変更</h1>
          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            初期パスワードのままです。新しいパスワードを設定してからご利用ください。
          </p>
        </div>

        {done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            パスワードを変更しました。新しいパスワードでログインしてください...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="newPassword">
                新しいパスワード <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="6文字以上"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword">
                新しいパスワード（確認）<span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="もう一度入力してください"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "変更中..." : "パスワードを変更する"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

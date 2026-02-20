"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Link2,
  Link2Off,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type FreeeStatus = {
  connected: boolean;
  companyId: number | null;
  lastSyncAt: string | null;
  masterCounts: {
    accountItems: number;
    partners: number;
    memoTags: number;
    sections: number;
  };
};

export default function FreeePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<FreeeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const hasClientId = !!process.env.NEXT_PUBLIC_FREEE_CLIENT_CONFIGURED;

  useEffect(() => {
    const successMsg = searchParams.get("success");
    const errorMsg = searchParams.get("error");
    if (successMsg === "connected") toast.success("freeeと連携しました");
    if (errorMsg === "auth_cancelled") toast.error("連携をキャンセルしました");
    if (errorMsg === "token_failed") toast.error("連携に失敗しました。再度お試しください");
    if (errorMsg === "no_credentials")
      toast.error("Client ID / Client Secret が設定されていません");
    if (successMsg || errorMsg) {
      router.replace("/admin/freee");
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/freee/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      toast.error("状態の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/freee/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        `同期完了: 勘定科目${data.results.accountItems ?? 0}件、取引先${data.results.partners ?? 0}件`
      );
      await fetchStatus();
    } catch (err: any) {
      toast.error(`同期失敗: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("freeeとの連携を解除しますか？")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/freee/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("解除に失敗しました");
      toast.success("freeeとの連携を解除しました");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        読み込み中...
      </div>
    );
  }

  const connected = status?.connected ?? false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">freee連携設定</h1>
        <p className="mt-1 text-sm text-gray-500">
          freee会計とのOAuth2接続を管理します
        </p>
      </div>

      {/* 接続状態 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            接続状態
            {connected ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                連携中
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500">
                <XCircle className="h-3 w-3 mr-1" />
                未連携
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">事業所ID</span>
                  <span className="font-medium">{status?.companyId ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">最終同期日時</span>
                  <span className="font-medium">
                    {status?.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleString("ja-JP")
                      : "未同期"}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "同期中..." : "マスタデータを同期"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Link2Off className="h-4 w-4" />
                  連携を解除
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                freee会計と連携すると、勘定科目・取引先・メモタグが自動で同期され、
                承認した申請をfreeeへ自動登録できます。
              </p>
              <a href="/api/freee/auth">
                <Button className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  freeeと連携する
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* マスタデータ状況 */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">同期済みマスタデータ</CardTitle>
            <CardDescription>
              「マスタデータを同期」ボタンで最新データを取得できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "勘定科目", count: status?.masterCounts.accountItems },
                { label: "取引先", count: status?.masterCounts.partners },
                { label: "メモタグ", count: status?.masterCounts.memoTags },
                { label: "部門", count: status?.masterCounts.sections },
              ].map(({ label, count }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className="text-lg font-bold">{count ?? 0}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 初期設定ガイド */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            初回設定手順
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              <a
                href="https://app.secure.freee.co.jp/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                freee Developers
                <ExternalLink className="h-3 w-3" />
              </a>
              でアプリを新規登録する
            </li>
            <li>
              コールバックURLに{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">
                {process.env.NEXTAUTH_URL ?? "http://localhost:3000"}
                /api/freee/callback
              </code>{" "}
              を設定する
            </li>
            <li>
              取得した Client ID / Client Secret を{" "}
              <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>{" "}
              に設定してサーバーを再起動する
            </li>
            <li>上の「freeeと連携する」ボタンをクリックしてOAuth認証を完了する</li>
            <li>「マスタデータを同期」ボタンで勘定科目・取引先を取得する</li>
          </ol>
          <div className="mt-3 rounded bg-gray-50 p-3 font-mono text-xs">
            <div className="text-gray-400"># .env.local</div>
            <div>FREEE_CLIENT_ID=（取得したClient ID）</div>
            <div>FREEE_CLIENT_SECRET=（取得したClient Secret）</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

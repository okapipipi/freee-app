import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { AuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as AuthUser | undefined;
  if (!session || (user?.role !== "admin" && user?.role !== "executive")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // cron エンドポイントを内部呼び出し
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET ?? "";

  const res = await fetch(`${baseUrl}/api/cron/sync-pl`, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "同期に失敗しました" },
      { status: res.status }
    );
  }

  return NextResponse.json(data);
}

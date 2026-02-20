import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";
import type { AuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ users: [] });

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;

  if (!keyJson || !adminEmail) {
    return NextResponse.json({ users: [], notConfigured: true });
  }

  let credentials: any;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    return NextResponse.json({ users: [], notConfigured: true });
  }

  if (!credentials.client_email || !credentials.private_key ||
      credentials.project_id === "...") {
    return NextResponse.json({ users: [], notConfigured: true });
  }

  try {
    const jwtClient = new google.auth.JWT({
      email:   credentials.client_email,
      key:     credentials.private_key,
      scopes:  ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
      subject: adminEmail,
    });

    const adminSdk = google.admin({ version: "directory_v1", auth: jwtClient });

    const res = await adminSdk.users.list({
      customer:   "my_customer",
      maxResults: 200,
      projection: "basic",
      orderBy:    "email",
    });

    const all = res.data.users ?? [];

    const matched = all
      .filter(u =>
        u.name?.fullName?.includes(q) ||
        u.primaryEmail?.toLowerCase().includes(q.toLowerCase())
      )
      .slice(0, 10)
      .map(u => ({
        name:  u.name?.fullName ?? "",
        email: u.primaryEmail ?? "",
      }));

    return NextResponse.json({ users: matched });
  } catch (err: any) {
    console.error("[google-users]", err.message);
    return NextResponse.json({ users: [], error: err.message }, { status: 500 });
  }
}

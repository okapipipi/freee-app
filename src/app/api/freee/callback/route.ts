import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/freee";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type { AuthUser } from "@/lib/auth";

const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return Response.redirect(
      new URL(`/admin/freee?error=auth_cancelled`, BASE)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const companyRes = await fetch(
      "https://api.freee.co.jp/api/1/companies",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const companyData = await companyRes.json();
    const companyId = companyData.companies?.[0]?.id ?? null;

    await db
      .insert(schema.freeeConfig)
      .values({
        id: "singleton",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        companyId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.freeeConfig.id,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          companyId,
          updatedAt: new Date(),
        },
      });

    return Response.redirect(new URL("/admin/freee?success=connected", BASE));
  } catch (err) {
    console.error("[freee callback]", err);
    return Response.redirect(
      new URL("/admin/freee?error=token_failed", BASE)
    );
  }
}

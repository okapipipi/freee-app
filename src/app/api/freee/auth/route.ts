import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getFreeeAuthUrl } from "@/lib/freee";
import type { AuthUser } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || (session.user as AuthUser).role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.FREEE_CLIENT_ID || !process.env.FREEE_CLIENT_SECRET) {
    return Response.redirect(
      new URL(
        "/admin/freee?error=no_credentials",
        process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
      )
    );
  }

  return Response.redirect(getFreeeAuthUrl());
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const user = session.user as AuthUser;

  if (user.mustChangePassword) {
    redirect("/settings/password");
  }

  switch (user.role) {
    case "admin":
      redirect("/admin/dashboard");
    case "executive":
      redirect("/executive/dashboard");
    case "employee":
      redirect("/employee/submit");
    default:
      redirect("/login");
  }
}

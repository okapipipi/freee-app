import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { AuthUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const user = session.user as AuthUser;
  if (user.role !== "admin") redirect("/");

  return (
    <AppShell userName={user.name} role={user.role}>
      {children}
    </AppShell>
  );
}

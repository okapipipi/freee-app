"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string;
  role: string;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar role={role} />
        <Header userName={userName} role={role} />
        <main className="ml-56 pt-14">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
